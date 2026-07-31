import { arab, DAY_NAMES, MONTH_NAMES, parseIso } from "@/lib/engine/dates.js"
import { dow } from "@/lib/engine/dates.js"

export { arab, DAY_NAMES, MONTH_NAMES, parseIso, dow }

export const dateOf = (iso: string) => iso.slice(0, 10)
export const timeOf = (iso: string) => iso.slice(11)

export function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  const ap = h < 12 ? "ص" : "م"
  const h12 = h % 12 || 12
  return m === 0 ? `${arab(h12)} ${ap}` : `${arab(h12)}:${arab(String(m).padStart(2, "0"))} ${ap}`
}

export const dayName = (d: string) => DAY_NAMES[dow(d)]

export function fmtDateLong(d: string): string {
  const p = parseIso(d)
  return `${dayName(d)}، ${arab(p.d)} ${MONTH_NAMES[p.m - 1]}`
}

// شريط اللون حسب المجموعة (ألوان جدول هيثم) — أصناف حرفية كاملة حتى يولّدها Tailwind
export function barColor(colorId: number, external?: boolean): string {
  if (external) return "after:bg-sky-500"
  return (
    {
      9: "after:bg-blue-600",
      10: "after:bg-emerald-600",
      6: "after:bg-orange-500",
      8: "after:bg-zinc-400",
    }[colorId] || "after:bg-sky-500"
  )
}

export function dotColor(colorId: number, external?: boolean): string {
  if (external) return "bg-sky-500"
  return (
    { 9: "bg-blue-600", 10: "bg-emerald-600", 6: "bg-orange-500", 8: "bg-zinc-400" }[colorId] ||
    "bg-sky-500"
  )
}

export const NUMBERED = /^[٠-٩]+\.\s/

export function checklistLines(desc: string): { text: string; idx: number; item: boolean }[] {
  if (!desc) return []
  return desc.split("\n").map((text, idx) => ({ text, idx, item: NUMBERED.test(text) }))
}

export function fmtDur(min: number): string {
  if (min <= 0) return "٠ د"
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${arab(h)} س${m ? ` ${arab(m)} د` : ""}` : `${arab(m)} د`
}

export const durMin = (e: { start: string; end: string }) =>
  Math.round((new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000)
