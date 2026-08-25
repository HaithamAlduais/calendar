"use client"

// مشاركة حدث كصورة عبر واتساب — تعرض الحالة وكل البنود بعلاماتها، لمتابعة الزوجة
import { arab } from "@/lib/engine/dates.js"
import { dateOf, fmt12, fmtDateLong, timeOf } from "@/lib/format"
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

export function eventStatus(ev: Ev, checked: Set<string>, prog?: { done: number; total: number }): string {
  if (prog && prog.total) {
    if (prog.done === 0) return "⬜ لم يبدأ بعد"
    if (prog.done >= prog.total) return "✅ اكتمل التمرين"
    return `🔄 قيد التنفيذ — ${arab(prog.done)} من ${arab(prog.total)} جلسة`
  }
  const items = ev.items.filter((i) => !i.note)
  const doneItems = items.filter((i) => checked.has(i.id)).length
  const n = new Date()
  const pad = (x: number) => String(x).padStart(2, "0")
  const stamp = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(n.getHours())}:${pad(n.getMinutes())}`
  if (ev.done) return "✅ أُنجز كاملًا"
  if (items.length && doneItems === items.length) return "✅ اكتملت كل البنود"
  if (doneItems > 0) return `🔄 قيد التنفيذ — أُنجز ${arab(doneItems)} من ${arab(items.length)}`
  if (ev.start <= stamp && ev.end > stamp) return "⏳ بدأتُ الآن"
  return "⬜ لم يبدأ بعد"
}

export async function shareEventImage(
  ev: Ev,
  checked: Set<string>,
  workout?: { prog: { done: number; total: number }; lines: string[] }
): Promise<"shared" | "downloaded"> {
  const W = 900
  const pad = 52
  const lineH = 48

  const c = document.createElement("canvas")
  const x = c.getContext("2d")!
  x.font = `400 28px ${FONT}`

  // لفّ الأسطر الطويلة مع حفظ نوع كل سطر
  const rlines: RLine[] = []
  if (workout) {
    // بطاقة التمرين: سطر لكل تمرين بحالته
    for (const raw of workout.lines) {
      const on = raw.startsWith("✅")
      const text = raw.slice(2)
      wrapText(x, text, W - pad * 2 - 56).forEach((t, i) =>
        rlines.push({ text: t, kind: i === 0 ? "item" : "cont", checked: on })
      )
    }
  } else {
    let num = 0 // الترقيم يُحسب عند العرض لا يُخزَّن في النص
    for (const l of ev.items) {
      const maxW = W - pad * 2 - (l.note ? 16 : 56)
      const label = l.note ? l.text : `${arab(++num)}. ${l.text}`
      wrapText(x, label, maxW).forEach((t, i) =>
        rlines.push({
          text: t,
          kind: l.note ? "plain" : i === 0 ? "item" : "cont",
          checked: checked.has(l.id),
        })
      )
    }
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
  const status = eventStatus(ev, checked, workout?.prog)
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
  x.fillText("تقويمي", pad, H - 36)

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
  const bodyLines = workout
    ? workout.lines
    : ev.items
        .filter((l) => !l.note)
        .map((l) => `${checked.has(l.id) ? "✅" : "⬜"} ${l.text}`)
  const txt = encodeURIComponent(`*${ev.title}* — ${status}\n` + bodyLines.join("\n"))
  window.open(`https://wa.me/?text=${txt}`, "_blank")
  return "downloaded"
}
