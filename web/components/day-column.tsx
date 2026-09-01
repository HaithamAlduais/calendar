"use client"

// عمود اليوم بمقياس الزمن: ارتفاعُ البلوك من مدته، والفراغُ بين البلوكات فراغٌ
// يُرى ويُملأ. وكان العمود بطاقاتٍ متساوية الارتفاع، فتبدو الفجرُ والظهرُ
// متجاورتين وبينهما سبع ساعات — والمستخدم يسأل: أين المسافة؟
import { cn } from "@/lib/utils"
import { arab } from "@/lib/engine/dates.js"
import { fmtDur } from "@/lib/format"
import { type Ev } from "@/lib/store"
import { EventChip } from "@/components/event-chip"

const PX_PER_MIN = 0.85 // ٢٤ ساعة ≈ ١٢٢٤ بكسل — يومٌ كامل بتمرير واحد
const MIN_H = 30 // أقصر بطاقة يسعها سطرها
const MIN_GAP_H = 6 // وأقصر فراغٍ يُرى فاصلًا

const mins = (a: string, b: string) => (Date.parse(b + ":00Z") - Date.parse(a + ":00Z")) / 60000

type Seg = { kind: "ev"; ev: Ev } | { kind: "gap"; from: string; to: string; len: number }

// البلوكات وما بينها من فراغ، بالترتيب
export function segments(evs: Ev[]): Seg[] {
  const out: Seg[] = []
  let prevEnd: string | null = null
  for (const ev of evs) {
    if (prevEnd && ev.start > prevEnd) {
      const len = mins(prevEnd, ev.start)
      if (len > 0) out.push({ kind: "gap", from: prevEnd, to: ev.start, len })
    }
    out.push({ kind: "ev", ev })
    if (!prevEnd || ev.end > prevEnd) prevEnd = ev.end
  }
  return out
}

const hhmm = (s: string) => {
  const h = +s.slice(11, 13)
  const m = +s.slice(14, 16)
  const ap = h < 12 ? "ص" : "م"
  const h12 = h % 12 || 12
  return `${arab(h12)}:${arab(String(m).padStart(2, "0"))} ${ap}`
}

export function DayColumn({
  evs,
  isCur,
  now,
  lt,
  em,
  dayCount,
  taskSlots,
  preview,
  onOpen,
  onFillGap,
}: {
  evs: Ev[]
  isCur: boolean
  now: string
  lt: Map<string, number>
  em: Map<string, unknown[]>
  dayCount: number
  taskSlots: string[]
  preview: boolean
  onOpen: (ev: Ev) => void
  onFillGap?: (from: string, to: string) => void
}) {
  const segs = segments(evs)
  return (
    <div className="flex flex-col">
      {segs.map((seg, i) =>
        seg.kind === "gap" ? (
          // الفراغ فراغٌ كما في تقويم Google: مساحةٌ بيضاء بقدر مدتها، بلا إطار
          // ولا نصّ — وعند مرور المؤشر وحده يظهر مقدارها ودعوةٌ لملئها
          <button
            key={`g${i}`}
            onClick={() => onFillGap?.(seg.from, seg.to)}
            style={{ height: Math.max(MIN_GAP_H, seg.len * PX_PER_MIN) }}
            aria-label={`${fmtDur(seg.len)} فارغة من ${hhmm(seg.from)} إلى ${hhmm(seg.to)}`}
            className={cn(
              "group my-0.5 flex w-full items-center justify-center rounded-md text-[11px]",
              onFillGap && "hover:bg-muted/40 cursor-pointer"
            )}
          >
            <span className="text-muted-foreground/70 opacity-0 transition-opacity group-hover:opacity-100">
              {fmtDur(seg.len)} — املأها
            </span>
          </button>
        ) : (
          <div
            key={seg.ev.id}
            style={{ minHeight: Math.max(MIN_H, mins(seg.ev.start, seg.ev.end) * PX_PER_MIN) }}
            className="my-0.5 flex flex-col"
          >
            <EventChip
              ev={seg.ev}
              now={now}
              current={isCur && seg.ev.start <= now && seg.ev.end > now}
              owedCount={lt.get(seg.ev.id) || 0}
              earlyCount={em.get(seg.ev.id)?.length || 0}
              dayCount={taskSlots.includes(seg.ev.slot || "") && !seg.ev.external ? dayCount : 0}
              preview={preview}
              onOpen={onOpen}
              grow
            />
          </div>
        )
      )}
    </div>
  )
}
