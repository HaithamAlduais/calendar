"use client"

// تنبيهات البلوكات: تنبيه قبل البلوك بثلاثين دقيقة وتنبيه عند بدئه
// تُجدوَل محليًا لما يلي ٢٦ ساعة، ويُعاد جدولتها عند كل فتح أو عودة للتطبيق
import { fmt12, timeOf } from "@/lib/format"
import type { Ev } from "@/lib/store"

let timers: number[] = []

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window
}

export function notificationsGranted(): boolean {
  return notificationsSupported() && Notification.permission === "granted"
}

export async function requestNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false
  return (await Notification.requestPermission()) === "granted"
}

export function scheduleNotifications(events: Ev[]): number {
  timers.forEach((t) => clearTimeout(t))
  timers = []
  if (!notificationsGranted()) return 0
  const now = Date.now()
  const horizon = now + 26 * 3600e3
  let count = 0
  for (const e of events) {
    if (e.external) continue
    const start = new Date(e.start).getTime()
    const plans: [number, string][] = [
      [30 * 60e3, `بعد ٣٠ دقيقة (${fmt12(timeOf(e.start))})`],
      [0, "يبدأ الآن"],
    ]
    for (const [off, label] of plans) {
      const at = start - off
      if (at <= now + 3000 || at >= horizon) continue
      timers.push(
        window.setTimeout(async () => {
          const title = `${e.title} — ${label}`
          const opts: NotificationOptions = {
            body: `${fmt12(timeOf(e.start))} – ${fmt12(timeOf(e.end))}`,
            icon: "icon-192.png",
            tag: `${e.id}:${off}`, // يمنع التكرار عند إعادة الجدولة
            dir: "rtl",
            lang: "ar",
          }
          try {
            const reg = await navigator.serviceWorker?.getRegistration()
            if (reg) await reg.showNotification(title, opts)
            else new Notification(title, opts)
          } catch {
            /* بعض المتصفحات تمنع التنبيه خارج التركيز */
          }
        }, at - now)
      )
      count++
    }
  }
  return count
}
