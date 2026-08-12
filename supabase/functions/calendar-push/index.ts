// إشعارات تقويم هيثم — /subscribe /unsubscribe /tick /test
// v6: دورة التمرين من السبت ٨ أغسطس ٢٠٢٦، وتسميات أسرة/أصدقاء/لعب أو نوم
// نسخة خادمية مطابقة لمحرك التطبيق (web/lib/engine) — أي تعديل هناك يُنقل هنا
import { createClient } from "jsr:@supabase/supabase-js@2"
import * as webpush from "jsr:@negrel/webpush"

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

// ── مواقيت أم القرى للرياض (مطابقة لـ web/lib/engine/prayers.js) ──
const LAT = 24.7136, LNG = 46.6753, TZ = 3, FAJR_ANGLE = 18.5, RIM = 0.833
const dtr = (d: number) => (d * Math.PI) / 180
const rtd = (r: number) => (r * 180) / Math.PI
const fix = (a: number, b: number) => { a -= b * Math.floor(a / b); return a < 0 ? a + b : a }
const fixHour = (a: number) => fix(a, 24)
const fixAngle = (a: number) => fix(a, 360)

function julian(y: number, m: number, d: number) {
  if (m <= 2) { y -= 1; m += 12 }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5
}
function sunPos(jd: number) {
  const D = jd - 2451545.0
  const g = fixAngle(357.529 + 0.98560028 * D), q = fixAngle(280.459 + 0.98564736 * D)
  const L = fixAngle(q + 1.915 * Math.sin(dtr(g)) + 0.020 * Math.sin(dtr(2 * g)))
  const e = 23.439 - 0.00000036 * D
  const RA = rtd(Math.atan2(Math.cos(dtr(e)) * Math.sin(dtr(L)), Math.cos(dtr(L)))) / 15
  return { decl: rtd(Math.asin(Math.sin(dtr(e)) * Math.sin(dtr(L)))), eqt: q / 15 - fixHour(RA) }
}
const midDay = (jd: number, t: number) => fixHour(12 - sunPos(jd + t).eqt)
function sat(jd: number, ang: number, t: number, dir: number) {
  const { decl } = sunPos(jd + t)
  const h = rtd(Math.acos((-Math.sin(dtr(ang)) - Math.sin(dtr(decl)) * Math.sin(dtr(LAT))) / (Math.cos(dtr(decl)) * Math.cos(dtr(LAT))))) / 15
  return midDay(jd, t) + dir * h
}
function asrT(jd: number, t: number) {
  const { decl } = sunPos(jd + t)
  const angle = -rtd(Math.atan(1 / (1 + Math.tan(dtr(Math.abs(LAT - decl))))))
  return sat(jd, angle, t, 1)
}
function prayerTimes(y: number, m: number, d: number) {
  const jd = julian(y, m, d) - LNG / (15 * 24)
  const toMin = (t: number) => Math.round(fixHour(t + TZ - LNG / 15) * 60)
  const mag = Math.ceil(fixHour(sat(jd, RIM, 18 / 24, 1) + TZ - LNG / 15) * 60) // المغرب يُقرَّب لأعلى
  return {
    fajr: toMin(sat(jd, FAJR_ANGLE, 5 / 24, -1)),
    sunrise: toMin(sat(jd, RIM, 6 / 24, -1)),
    dhuhr: toMin(midDay(jd, 12 / 24)),
    asr: toMin(asrT(jd, 13 / 24)),
    maghrib: mag,
    isha: mag + 90,
  }
}

const DAYMS = 86400000
function fromEpochDay(e: number) {
  const dt = new Date(e * DAYMS)
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), dow: dt.getUTCDay() }
}
const epochDayRiyadhNow = () => Math.floor((Date.now() + TZ * 3600e3) / DAYMS)

// دورة التمرين المتتابعة (لا علاقة لها بأيام الأسبوع): تبدأ الأحد ٩ أغسطس ٢٠٢٦
const GYM_EPOCH = Math.floor(Date.UTC(2026, 7, 13) / DAYMS)
function trainTitle(epochDay: number): string {
  const off = epochDay - GYM_EPOCH
  if (off < 0 || off % 2 === 1) return "تطوير"
  const t = (off / 2) % 3
  return t === 0 ? "تمرين — اليوم الأول" : t === 1 ? "تمرين — اليوم الثاني" : "تمرين — اليوم الثالث (جري)"
}

// وحدة اليوم: من الفجر إلى فجر الغد (مطابقة لـ buildUnit)
function unitEvents(epochDay: number): { title: string; minute: number }[] {
  const cur = fromEpochDay(epochDay), next = fromEpochDay(epochDay + 1)
  const P1 = prayerTimes(cur.y, cur.m, cur.d), P2 = prayerTimes(next.y, next.m, next.d)
  const F = P1.fajr, SR = P1.sunrise, DH = P1.dhuhr, AS = P1.asr, M = P1.maghrib, ISH = P1.isha
  const F2 = P2.fajr + 1440
  const night = F2 - M
  const t1 = M + Math.round(night / 3) // نهاية أسرة الليلية
  const t2 = M + Math.round((2 * night) / 3) // نهاية الثلث الثاني: يليه نوم
  const trainEnd = SR + 90
  const avail = Math.max(0, DH - trainEnd - 150)
  const work1End = trainEnd + Math.round(avail / 2) // العمل الأول ثم راحة الضحى
  const napEnd = Math.min(DH, work1End + 150)
  const dow = cur.dow, friday = dow === 5, weekend = dow === 5 || dow === 6
  const work = weekend ? "أسرة" : "عمل"
  const late = friday ? "أسرة ودعاء" : weekend ? "أسرة" : "عمل"
  const train = trainTitle(epochDay)
  const ev: [string, number][] = [
    ["الفجر", F], ["قرآن وسنة الضحى", F + 45], [train, SR + 15], [work, trainEnd],
    ["نوم", work1End], [work, napEnd], ["الظهر", DH], [work, DH + 45],
    ["العصر", AS], [late, AS + 45],
    ["المغرب", M], ["نوم", M + 30], ["العشاء", ISH], ["أسرة", ISH + 45],
    ["راحة", t1], ["صلاة القيام", t2 - 45], ["نوم", t2],
  ]
  const baseMin = epochDay * 1440 - TZ * 60 // منتصف ليل الرياض بدقائق يونكس
  return ev.map(([title, min]) => ({ title, minute: baseMin + min }))
}

const ARD = "٠١٢٣٤٥٦٧٨٩"
const arab = (x: number | string) => String(x).replace(/[0-9]/g, (d) => ARD[+d])
function fmt12(unixMin: number) {
  const m = (((unixMin + TZ * 60) % 1440) + 1440) % 1440
  const h = Math.floor(m / 60), mm = m % 60, ap = h < 12 ? "ص" : "م", h12 = h % 12 || 12
  return mm === 0 ? `${arab(h12)} ${ap}` : `${arab(h12)}:${arab(String(mm).padStart(2, "0"))} ${ap}`
}

async function getAppServer() {
  const { data, error } = await supa.from("calendar_push_config").select("value").eq("key", "vapid").single()
  if (error) throw error
  const vapidKeys = await webpush.importVapidKeys(data.value, { extractable: false })
  return webpush.ApplicationServer.new({ contactInformation: "mailto:haithamhameed15@gmail.com", vapidKeys })
}

async function sendToAll(payloads: { title: string; body: string; tag: string }[]) {
  if (!payloads.length) return { sent: 0, subs: 0, errors: [] as string[] }
  const { data: subs, error } = await supa.from("calendar_push_subscriptions").select("id,endpoint,subscription")
  if (error) throw error
  const errors: string[] = []
  let appServer
  try {
    appServer = await getAppServer()
  } catch (e) {
    const msg = `vapid: ${String(e)}`
    console.error(msg)
    return { sent: 0, subs: (subs ?? []).length, errors: [msg] }
  }
  let sent = 0
  for (const s of subs ?? []) {
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
  return { sent, subs: (subs ?? []).length, errors }
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
      await supa.from("calendar_push_subscriptions").upsert({ endpoint: sub.endpoint, subscription: sub }, { onConflict: "endpoint" })
      return json({ ok: true })
    }
    if (path === "unsubscribe" && req.method === "POST") {
      const { endpoint } = await req.json()
      await supa.from("calendar_push_subscriptions").delete().eq("endpoint", endpoint)
      return json({ ok: true })
    }
    if (path === "test") {
      return json(await sendToAll([{ title: "🔔 اختبار تقويم هيثم", body: "إن وصلك هذا فالخادم يعمل ✅", tag: "test" }]))
    }
    if (path === "tick") {
      const nowMin = Math.floor(Date.now() / 60000)
      const today = epochDayRiyadhNow()
      const events = [...unitEvents(today - 1), ...unitEvents(today), ...unitEvents(today + 1)]
      const payloads: { title: string; body: string; tag: string }[] = []
      for (const e of events) {
        if (e.minute === nowMin)
          payloads.push({ title: `🕌 ${e.title} — الآن`, body: `بدأ وقت «${e.title}» (${fmt12(e.minute)})`, tag: `s${e.minute}` })
        if (e.minute - 30 === nowMin)
          payloads.push({ title: `⏰ ${e.title} بعد ٣٠ دقيقة`, body: `يبدأ «${e.title}» الساعة ${fmt12(e.minute)}`, tag: `p${e.minute}` })
      }
      if (url.searchParams.get("dry"))
        return json({
          nowMin,
          payloads,
          upcoming: events.filter((e) => e.minute >= nowMin && e.minute < nowMin + 240).map((e) => ({ t: e.title, at: fmt12(e.minute) })),
        })
      return json({ ...(await sendToAll(payloads)), fired: payloads.length })
    }
    return json({ error: "not found" }, 404)
  } catch (e) {
    console.error(String(e))
    return json({ error: String(e) }, 500)
  }
})
