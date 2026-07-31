"use client"

// سحب أحداث Google Calendar للعرض فقط — OAuth في المتصفح، لا يُخزَّن شيء خارج جهازك
import type { Ev } from "@/lib/store"

const SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly"
const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events"

let accessToken: string | null = null

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: object) => { requestAccessToken: () => void }
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

export async function connect(clientId: string): Promise<void> {
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp: { error?: string; access_token?: string }) => {
        if (resp.error) return reject(new Error(resp.error))
        accessToken = resp.access_token!
        resolve()
      },
      error_callback: (err: { type?: string }) => reject(new Error(err.type || "فشل تسجيل الدخول")),
    })
    client.requestAccessToken()
  })
}

export function isConnected() {
  return !!accessToken
}

const rfc3339 = (s: string) => `${s}:00+03:00`

// أحداث Google في النطاق (نستبعد الموسومة بتطبيقنا القديم إن وُجدت)
export async function pullEvents(fromIso: string, toIso: string): Promise<Ev[]> {
  const out: Ev[] = []
  let pageToken = ""
  do {
    const url =
      `${API}?maxResults=2500&singleEvents=true&timeZone=Asia%2FRiyadh` +
      `&timeMin=${encodeURIComponent(rfc3339(fromIso + "T00:00"))}` +
      `&timeMax=${encodeURIComponent(rfc3339(toIso + "T23:59"))}` +
      (pageToken ? `&pageToken=${pageToken}` : "")
    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (r.status === 401) {
      accessToken = null
      throw new Error("انتهت صلاحية الجلسة — اضغط «اتصال» مرة أخرى")
    }
    if (!r.ok) throw new Error(`Google API ${r.status}`)
    const data = await r.json()
    for (const g of data.items || []) {
      if (g.extendedProperties?.private?.hcApp === "1") continue
      if (!g.start?.dateTime) continue
      out.push({
        id: `g:${g.id}`,
        title: g.summary || "(بلا عنوان)",
        start: g.start.dateTime.slice(0, 16),
        end: g.end.dateTime.slice(0, 16),
        colorId: 7,
        desc: g.description || "",
        external: true,
      })
    }
    pageToken = data.nextPageToken || ""
  } while (pageToken)
  return out
}
