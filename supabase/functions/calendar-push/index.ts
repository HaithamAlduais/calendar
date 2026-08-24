// إشعارات التقويم — /subscribe /unsubscribe /tick /test
//
// v10: لكل مشترك جدولُه. كانت الدالة تحمل نسخةً مكتوبةً باليد من محرك التطبيق،
// مثبَّتًا فيها موقعُ صاحبه ومواقيتُه وشكلُ يومه وأسماءُ بلوكاته — فكان كل من
// اشترك يتلقّى إشعارات جدول رجلٍ آخر في مدينةٍ أخرى. والآن:
//   • المحرك نفسُه (web/lib/engine) يُنسخ آليًّا إلى _shared/engine بـ
//     `npm run sync:engine`، ويحرسه فحصٌ يسقط إن تباعدت النسختان.
//   • إعدادات كل مشترك تُقرأ من user_state (المفتاح hc.settings.v2) الذي
//     تكتبه المزامنة، فيُبنى يومُه بموقعه وطريقة حسابه وقوالبه وبداية يومه.
//   • هوية المشترك تُؤخذ من رمز دخوله لا مما يرسله، فلا ينتحل أحدٌ أحدًا.
import { createClient } from "jsr:@supabase/supabase-js@2"
import * as webpush from "jsr:@negrel/webpush"
import { blocksAround, duePayloads, fmt12, FALLBACK } from "../_shared/notify.js"

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const SETTINGS_KEY = "hc.settings.v2"

type Anchor = Record<string, unknown>
type Block = { id: string; title: string; end: Anchor }
type Template = { start: Anchor; blocks: Block[] }
type Settings = {
  lat: number
  lng: number
  tz: number
  method: string
  asrFactor: number
  templates: Record<string, Template>
  weekPlan: string[]
  dayStart: { blockId?: string; anchor?: Anchor } | null
  startDate?: string
}

type Payload = { title: string; body: string; tag: string }

async function getAppServer() {
  const { data, error } = await supa
    .from("calendar_push_config")
    .select("value")
    .eq("key", "vapid")
    .single()
  if (error) throw error
  const vapidKeys = await webpush.importVapidKeys(data.value, { extractable: false })
  return webpush.ApplicationServer.new({
    contactInformation: "mailto:haithamhameed15@gmail.com",
    vapidKeys,
  })
}

type Sub = {
  id: string
  endpoint: string
  subscription: webpush.PushSubscription
  user_id: string | null
}

// إعدادات كل مشترك من صفّه في user_state — استعلامٌ واحد لكل المشتركين
async function settingsByUser(ids: string[]): Promise<Map<string, Settings>> {
  const map = new Map<string, Settings>()
  if (!ids.length) return map
  const { data, error } = await supa
    .from("user_state")
    .select("user_id,value")
    .eq("key", SETTINGS_KEY)
    .in("user_id", ids)
  if (error) throw error
  for (const row of data ?? []) {
    const v = row.value as Partial<Settings> | null
    if (v && v.templates && v.weekPlan) map.set(row.user_id as string, { ...FALLBACK, ...v })
  }
  return map
}

async function sendEach(
  make: (s: Settings) => Payload[],
  fixed?: Payload[]
): Promise<{ sent: number; subs: number; users: number; errors: string[] }> {
  const { data: subs, error } = await supa
    .from("calendar_push_subscriptions")
    .select("id,endpoint,subscription,user_id")
  if (error) throw error
  const list = (subs ?? []) as Sub[]
  const errors: string[] = []
  if (!list.length) return { sent: 0, subs: 0, users: 0, errors }

  const ids = [...new Set(list.map((s) => s.user_id).filter(Boolean))] as string[]
  const byUser = await settingsByUser(ids)

  let appServer
  try {
    appServer = await getAppServer()
  } catch (e) {
    const msg = `vapid: ${String(e)}`
    console.error(msg)
    return { sent: 0, subs: list.length, users: byUser.size, errors: [msg] }
  }

  // الحساب مرة واحدة لكل مستخدم لا لكل جهاز — فأجهزته الثلاثة جدولٌ واحد
  const cache = new Map<string, Payload[]>()
  const forUser = (uid: string | null): Payload[] => {
    const key = uid ?? "-"
    if (!cache.has(key)) cache.set(key, make((uid && byUser.get(uid)) || FALLBACK))
    return cache.get(key)!
  }

  let sent = 0
  for (const s of list) {
    const payloads = fixed ?? forUser(s.user_id)
    if (!payloads.length) continue
    try {
      const subscriber = appServer.subscribe(s.subscription)
      for (const p of payloads) {
        try {
          await subscriber.pushTextMessage(JSON.stringify(p), {})
          sent++
        } catch (e) {
          const st = (e as { response?: { status?: number } })?.response?.status
          const msg = `push(${s.id}) st=${st ?? "?"} ${String(e).slice(0, 200)}`
          console.error(msg)
          errors.push(msg)
          if (st === 404 || st === 410) {
            await supa.from("calendar_push_subscriptions").delete().eq("id", s.id) // اشتراك ميت
            break
          }
        }
      }
    } catch (e) {
      const msg = `subscribe(${s.id}): ${String(e).slice(0, 200)}`
      console.error(msg)
      errors.push(msg)
    }
  }
  return { sent, subs: list.length, users: byUser.size, errors }
}

// هوية المشترك من رمز دخوله لا مما يرسله — وإلا انتحل أحدٌ صفوف غيره
async function userIdFrom(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") || ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  if (!token || token === Deno.env.get("SUPABASE_ANON_KEY")) return null
  const { data, error } = await supa.auth.getUser(token)
  if (error) return null
  return data.user?.id ?? null
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const path = url.pathname.split("/").pop()
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), {
      status: s,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      },
    })
  if (req.method === "OPTIONS") return json({ ok: true })
  try {
    if (path === "subscribe" && req.method === "POST") {
      const sub = await req.json()
      if (!sub?.endpoint) return json({ error: "bad subscription" }, 400)
      const user_id = await userIdFrom(req)
      await supa
        .from("calendar_push_subscriptions")
        .upsert({ endpoint: sub.endpoint, subscription: sub, user_id }, { onConflict: "endpoint" })
      return json({ ok: true, linked: !!user_id })
    }
    if (path === "unsubscribe" && req.method === "POST") {
      const { endpoint } = await req.json()
      await supa.from("calendar_push_subscriptions").delete().eq("endpoint", endpoint)
      return json({ ok: true })
    }
    if (path === "test") {
      return json(
        await sendEach(() => [], [
          { title: "🔔 اختبار التقويم", body: "إن وصلك هذا فالخادم يعمل ✅", tag: "test" },
        ])
      )
    }
    if (path === "tick") {
      const nowMin = Math.floor(Date.now() / 60000)
      if (url.searchParams.get("dry")) {
        // فحصٌ جاف: ماذا يُرسَل الآن لكل مشترك، وما بلوكاته القادمة
        const { data: subs } = await supa
          .from("calendar_push_subscriptions")
          .select("id,user_id")
        const list = (subs ?? []) as { id: string; user_id: string | null }[]
        const ids = [...new Set(list.map((s) => s.user_id).filter(Boolean))] as string[]
        const byUser = await settingsByUser(ids)
        const seen = new Set<string>()
        const report = []
        for (const s of list) {
          const key = s.user_id ?? "-"
          if (seen.has(key)) continue
          seen.add(key)
          const cfg = (s.user_id && byUser.get(s.user_id)) || FALLBACK
          report.push({
            user: s.user_id ? s.user_id.slice(0, 8) : "بلا حساب",
            configured: !!(s.user_id && byUser.has(s.user_id)),
            tz: cfg.tz,
            payloads: duePayloads(cfg, nowMin),
            upcoming: blocksAround(cfg)
              .filter((b) => b.minute >= nowMin && b.minute < nowMin + 240)
              .map((b) => ({ t: b.title, at: fmt12(b.at) })),
          })
        }
        return json({ nowMin, subs: list.length, report })
      }
      const r = await sendEach((s) => duePayloads(s, nowMin))
      return json(r)
    }
    return json({ error: "not found" }, 404)
  } catch (e) {
    console.error(String(e))
    return json({ error: String(e) }, 500)
  }
})
