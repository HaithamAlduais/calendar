"use client"

// إشعارات مضمونة عبر خادم Supabase — تصل حتى والتطبيق مغلق تمامًا
// الخادم يحسب الجدول بنفس معادلات التطبيق ويرسل تنبيهين لكل بلوك (٣٠ د قبله وعند بدئه)

const FN = "https://znlkhlfmhdjmldnmrrym.supabase.co/functions/v1/calendar-push"
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpubGtobGZtaGRqbWxkbm1ycnltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NTI1MzUsImV4cCI6MjA5NDIyODUzNX0.ExdzTK92X6d8YerUwiDk4YQuRgl816uSsbs0ph_3k34"
const APP_SERVER_KEY = "BGMv-IDvoG1IBAjEB0euk9GFeFsqT-9TSABbu-gOvqvfm-r2jI09OuDrp9enXdDzGRg-r0lwUIPrNfhfhkkwKBU"

function b64uToUint8(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${ANON}`,
  apikey: ANON,
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
}

// الاشتراك: يتطلب إذن الإشعارات ممنوحًا وعامل خدمة نشطًا
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64uToUint8(APP_SERVER_KEY).buffer as ArrayBuffer,
      }))
    const r = await fetch(`${FN}/subscribe`, {
      method: "POST",
      headers,
      body: JSON.stringify(sub.toJSON()),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await fetch(`${FN}/unsubscribe`, {
        method: "POST",
        headers,
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {})
      await sub.unsubscribe()
    }
  } catch {
    /* تجاهل */
  }
}
