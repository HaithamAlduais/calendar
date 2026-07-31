"use client"

// مشاركة حدث كصورة عبر واتساب — تعرض الحالة وكل البنود بعلاماتها، لمتابعة الزوجة
import { arab } from "@/lib/engine/dates.js"
import { checklistLines, dateOf, fmt12, fmtDateLong, timeOf } from "@/lib/format"
import type { Ev } from "@/lib/store"

const ACCENT: Record<number, string> = {
  9: "#2563eb",
  10: "#059669",
  6: "#f97316",
  8: "#71717a",
}

const FONT = '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif'

type RLine = { text: string; kind: "item" | "cont" | "plain"; checked: boolean }

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ")
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur)
      cur = w
    } else cur = t
  }
  if (cur) lines.push(cur)
  return lines
}

export function eventStatus(ev: Ev, checked: Set<number>): string {
  const items = checklistLines(ev.desc).filter((l) => l.item)
  const doneItems = items.filter((l) => checked.has(l.idx)).length
  const n = new Date()
  const pad = (x: number) => String(x).padStart(2, "0")
  const stamp = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(n.getHours())}:${pad(n.getMinutes())}`
  if (ev.done) return "✅ أُنجز كاملًا"
  if (items.length && doneItems === items.length) return "✅ اكتملت كل البنود"
  if (doneItems > 0) return `🔄 قيد التنفيذ — أُنجز ${arab(doneItems)} من ${arab(items.length)}`
  if (ev.start <= stamp && ev.end > stamp) return "⏳ بدأتُ الآن"
  return "⬜ لم يبدأ بعد"
}

export async function shareEventImage(ev: Ev, checked: Set<number>): Promise<"shared" | "downloaded"> {
  const W = 900
  const pad = 52
  const lineH = 48

  const c = document.createElement("canvas")
  const x = c.getContext("2d")!
  x.font = `400 28px ${FONT}`

  // لفّ الأسطر الطويلة مع حفظ نوع كل سطر
  const lines = checklistLines(ev.desc)
  const rlines: RLine[] = []
  for (const l of lines) {
    const maxW = W - pad * 2 - (l.item ? 56 : 16)
    wrapText(x, l.text, maxW).forEach((t, i) =>
      rlines.push({
        text: t,
        kind: l.item ? (i === 0 ? "item" : "cont") : "plain",
        checked: checked.has(l.idx),
      })
    )
  }

  const headerH = 210
  const H = headerH + rlines.length * lineH + 110
  c.width = W
  c.height = H
  x.direction = "rtl"
  x.textAlign = "right"

  // الخلفية والشريط الملون
  x.fillStyle = "#ffffff"
  x.fillRect(0, 0, W, H)
  x.fillStyle = ACCENT[ev.colorId] || "#0ea5e9"
  x.fillRect(W - 12, 0, 12, H)

  const xr = W - pad
  // العنوان
  x.fillStyle = "#18181b"
  x.font = `700 42px ${FONT}`
  x.fillText(ev.title, xr, 78)
  // التاريخ والوقت
  x.fillStyle = "#71717a"
  x.font = `400 26px ${FONT}`
  x.fillText(
    `${fmtDateLong(dateOf(ev.start))} ⋅ ${fmt12(timeOf(ev.start))} – ${fmt12(timeOf(ev.end))}`,
    xr,
    122
  )
  // الحالة
  const status = eventStatus(ev, checked)
  x.font = `600 30px ${FONT}`
  x.fillStyle = status.startsWith("✅") ? "#059669" : status.startsWith("⬜") ? "#71717a" : "#d97706"
  x.fillText(status, xr, 172)
  // فاصل
  x.strokeStyle = "#e4e4e7"
  x.lineWidth = 2
  x.beginPath()
  x.moveTo(pad, 192)
  x.lineTo(xr, 192)
  x.stroke()

  // البنود
  let y = headerH + 34
  for (const l of rlines) {
    if (l.kind === "plain") {
      x.fillStyle = "#a1a1aa"
      x.font = `400 24px ${FONT}`
      x.fillText(l.text, xr, y)
    } else {
      const prefix = l.kind === "item" ? (l.checked ? "✅ " : "⬜ ") : "     "
      x.fillStyle = l.checked ? "#a1a1aa" : "#27272a"
      x.font = `400 28px ${FONT}`
      x.fillText(prefix + l.text, xr, y)
    }
    y += lineH
  }

  // التذييل
  x.fillStyle = "#d4d4d8"
  x.font = `400 22px ${FONT}`
  x.textAlign = "left"
  x.fillText("تقويم هيثم", pad, H - 36)

  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/png"))
  const file = new File([blob], `${ev.title}.png`, { type: "image/png" })

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: ev.title, text: status })
    return "shared"
  }
  // بديل سطح المكتب: تنزيل الصورة وفتح واتساب ويب بنص الملخص لإرفاقها
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `${ev.title}.png`
  a.click()
  URL.revokeObjectURL(a.href)
  const items = checklistLines(ev.desc).filter((l) => l.item)
  const txt = encodeURIComponent(
    `*${ev.title}* — ${status}\n` +
      items.map((l) => `${checked.has(l.idx) ? "✅" : "⬜"} ${l.text}`).join("\n")
  )
  window.open(`https://wa.me/?text=${txt}`, "_blank")
  return "downloaded"
}
