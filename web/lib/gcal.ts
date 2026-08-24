"use client"

// سحب أحداث Google Calendar من عدة حسابات (عرض فقط، صلاحية قراءة فقط)
// كل حساب يُضاف مرة عبر شاشة اختيار حسابات Google، والرموز تبقى في الذاكرة للجلسة
import type { Ev } from "@/lib/store"

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly"
const API = "https://www.googleapis.com/calendar/v3"

// بريد الحساب ← رمز الوصول (لجلسة المتصفح الحالية فقط)
const tokens = new Map<string, string>()

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: object) => { requestAccessToken: (o?: object) => void }
        }
      }
    }
  }
}

function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const s = document.createElement("script")
    s.src = "https://accounts.google.com/gsi/client"
    s.onload = () => resolve()
    s.onerror = () => reject(new Error("تعذّر تحميل مكتبة Google — تحقق من الاتصال"))
    document.head.appendChild(s)
  })
}

// طلب رمز وصول: forceSelect يفتح شاشة اختيار الحسابات، وإلا محاولة صامتة بالحساب المحدد
function requestToken(
  clientId: string,
  opts: { hint?: string; forceSelect?: boolean }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp: { error?: string; access_token?: string }) => {
        if (resp.error) return reject(new Error(resp.error))
        resolve(resp.access_token!)
      },
      error_callback: (err: { type?: string }) =>
        reject(new Error(err.type === "popup_closed" ? "أُغلقت نافذة Google" : err.type || "فشل تسجيل الدخول")),
    })
    client.requestAccessToken(
      opts.forceSelect
        ? { prompt: "select_account" }
        : { prompt: "", login_hint: opts.hint }
    )
  })
}

async function api(path: string, token: string) {
  const r = await fetch(`${API}/${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (r.status === 401) throw new Error("انتهت صلاحية الجلسة")
  if (!r.ok) throw new Error(`Google API ${r.status}`)
  return r.json()
}

// إضافة حساب: شاشة الاختيار ← رمز ← نقرأ بريد الحساب من تقويمه الأساسي
export async function addAccount(clientId: string): Promise<string> {
  await loadGis()
  const token = await requestToken(clientId, { forceSelect: true })
  const cal = await api("calendars/primary", token)
  const email = cal.id as string
  tokens.set(email, token)
  return email
}

async function tokenFor(clientId: string, email: string): Promise<string> {
  const cached = tokens.get(email)
  if (cached) return cached
  await loadGis()
  // محاولة صامتة أولًا (تنجح إن كان الحساب مسجلًا في المتصفح)، وإلا تنبثق نافذة Google
  const token = await requestToken(clientId, { hint: email }).catch(() =>
    requestToken(clientId, { hint: email, forceSelect: true })
  )
  tokens.set(email, token)
  return token
}

export function dropToken(email: string) {
  tokens.delete(email)
}

// جلب أحداث حساب واحد في النطاق، موسومة ببريده ولون فهرسه
export async function pullAccount(
  clientId: string,
  email: string,
  accountIdx: number,
  fromIso: string,
  toIso: string
): Promise<Ev[]> {
  const token = await tokenFor(clientId, email)
  const rfc = (s: string) => encodeURIComponent(`${s}:00+03:00`)
  const out: Ev[] = []
  let pageToken = ""
  do {
    const data = await api(
      `calendars/primary/events?maxResults=2500&singleEvents=true&timeZone=Asia%2FRiyadh` +
        `&timeMin=${rfc(fromIso + "T00:00")}&timeMax=${rfc(toIso + "T23:59")}` +
        (pageToken ? `&pageToken=${pageToken}` : ""),
      token
    )
    for (const g of data.items || []) {
      if (g.extendedProperties?.private?.hcApp === "1") continue
      if (!g.start?.dateTime) continue
      out.push({
        id: `g:${email}:${g.id}`,
        title: g.summary || "(بلا عنوان)",
        start: g.start.dateTime.slice(0, 16),
        end: g.end.dateTime.slice(0, 16),
        colorId: [7, 3, 5, 4][accountIdx % 4], // لون مميز لكل حساب
        items: g.description ? [{ id: "desc", text: g.description, note: true }] : [],
        external: true,
        account: email,
      })
    }
    pageToken = data.nextPageToken || ""
  } while (pageToken)
  return out
}
