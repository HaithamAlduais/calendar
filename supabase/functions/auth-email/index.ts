// رابط الدخول بالبريد — يولّده Supabase ويرسله Resend برسالة عربية.
//
// لماذا دالة بدل بريد Supabase الافتراضي؟ لأنه محدود العدد ورسالته إنجليزية،
// ولأن هذا يتيح تصميم الرسالة كما نريد بلا لمس إعدادات المشروع.
//
// المفتاح في أسرار المشروع لا في الشيفرة: supabase secrets set RESEND_API_KEY=…
import { createClient } from "jsr:@supabase/supabase-js@2"

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? ""
// نطاق مُوثَّق في Resend. وما لم يُضبط، يُستعمل نطاق التجربة الذي لا يصل
// إلا إلى بريد صاحب حساب Resend نفسه.
const FROM = Deno.env.get("MAIL_FROM") ?? "تقويمي <onboarding@resend.dev>"

const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
}
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: cors })

function emailHtml(link: string) {
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#0b0f14;font-family:system-ui,'Segoe UI',Tahoma,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;color:#e6edf3">
    <div style="font-size:20px;font-weight:700;margin-bottom:8px">تسجيل الدخول إلى تقويمك</div>
    <p style="color:#9fb0c0;line-height:1.9;margin:0 0 24px">
      اضغط الزر لتدخل. الرابط صالح لساعة واحدة ولمرة واحدة، وإن لم تكن أنت من طلبه فأهمل هذه الرسالة.
    </p>
    <a href="${link}" style="display:inline-block;background:#0b8043;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">
      ادخل إلى تقويمك
    </a>
    <p style="color:#6b7d8f;font-size:12px;line-height:1.8;margin:24px 0 0">
      أو انسخ هذا العنوان في متصفحك:<br>
      <span style="color:#9fb0c0;word-break:break-all">${link}</span>
    </p>
  </div></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true })
  if (req.method !== "POST") return json({ error: "POST only" }, 405)
  try {
    const { email, redirectTo } = await req.json()
    if (!email || !String(email).includes("@")) return json({ error: "بريد غير صالح" }, 400)
    if (!RESEND_KEY) return json({ error: "RESEND_API_KEY غير مضبوط في أسرار المشروع" }, 500)

    const options = redirectTo ? { redirectTo } : undefined
    // المستخدم القائم يأخذ رابط دخول، والجديد يُنشأ حسابه أولًا
    let res = await admin.auth.admin.generateLink({ type: "magiclink", email, options })
    if (res.error) {
      const created = await admin.auth.admin.createUser({ email, email_confirm: true })
      if (created.error) return json({ error: created.error.message }, 400)
      res = await admin.auth.admin.generateLink({ type: "magiclink", email, options })
      if (res.error) return json({ error: res.error.message }, 400)
    }

    const link = res.data?.properties?.action_link
    if (!link) return json({ error: "تعذّر توليد الرابط" }, 500)

    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: "رابط الدخول إلى تقويمك",
        html: emailHtml(link),
      }),
    })
    if (!sent.ok) {
      const body = await sent.text()
      console.error("resend", sent.status, body)
      return json({ error: `تعذّر الإرسال (${sent.status})`, detail: body.slice(0, 300) }, 502)
    }
    return json({ ok: true })
  } catch (e) {
    console.error(String(e))
    return json({ error: String(e) }, 500)
  }
})
