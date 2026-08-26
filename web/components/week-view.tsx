"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"
import { addDays, arab, parseIso } from "@/lib/engine/dates.js"
import { dayName } from "@/lib/format"
import {
  currentUnit,
  dayTasks,
  earlyMap,
  isPreviewing,
  makeupMap,
  nowStamp,
  previewVisibleSlots,
  TASK_SLOTS,
  type Ev,
} from "@/lib/store"
import { DayColumn } from "@/components/day-column"

// عمود اليوم قائمةُ بلوكاتٍ متصلة من بداية وحدته إلى نهايتها — بلا تقسيمٍ مفروض
// إلى ليلٍ ونهار: فبنيةُ اليوم يرسمها صاحبه في قالبه، والعرضُ يتبعها لا يعلوها.

export function WeekView({
  weekStart,
  events,
  onOpen,
}: {
  weekStart: string
  events: Ev[]
  onOpen: (ev: Ev) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const cu = currentUnit()
  const curRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const center = () => curRef.current?.scrollIntoView({ inline: "center", block: "nearest" })
    center()
    window.addEventListener("resize", center)
    return () => window.removeEventListener("resize", center)
  }, [weekStart])

  const now = nowStamp()
  const pv = isPreviewing() // معاينة المعالج: مخططٌ نظيف بلا قضاءٍ ولا عدّادات
  const pvSlots = pv ? previewVisibleSlots() : null // وما لم يُبنَ بعدُ لا يُعرض
  const mk = pv ? new Map<string, unknown[]>() : makeupMap(events, now)
  const em = pv ? new Map<string, unknown[]>() : earlyMap(events, now)

  return (
    // سبعة أعمدة لا تُعرض إلا إذا اتّسع لها فعلًا (≥١٢٨٠ بكسل ≈ ١٧٠ لكل عمود)،
    // وما دون ذلك تمرير أفقي بيوم واحد كامل — أوضح من سبعة أعمدة مزدحمة
    <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-2 pb-6 xl:grid xl:grid-cols-7 xl:gap-1 xl:overflow-visible xl:px-3">
      {days.map((d) => {
        const isCur = d === cu
        // عمود اليوم = وحدته كاملة بترتيبها الزمني
        // البلوك الصفري لا يُعرض: كقيلولةٍ ألغاها اكتمالُ نوم الليل
        const unitEvs = events
          .filter(
            (e) =>
              e.unit === d &&
              e.start !== e.end &&
              (!pvSlots || pvSlots.has(e.slot || ""))
          )
          .sort((a, b) => (a.start < b.start ? -1 : 1))
        const dayCount = pv ? 0 : dayTasks(unitEvs, d).length // مهام اليوم العائمة ما لم تُنجز
        return (
          <div
            key={d}
            ref={isCur ? curRef : undefined}
            className="w-[82vw] max-w-80 flex-none snap-center xl:w-auto xl:max-w-none"
          >
            <div className="bg-background/95 sticky top-0 z-10 flex items-center justify-center gap-2 py-2 backdrop-blur">
              <span
                className={cn("text-muted-foreground text-xs", isCur && "text-primary font-semibold")}
              >
                {dayName(d)}
              </span>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                  isCur ? "bg-primary text-primary-foreground" : "text-foreground"
                )}
              >
                {arab(parseIso(d).d)}
              </span>
            </div>
            {unitEvs.length === 0 ? (
              <div className="text-muted-foreground/60 py-8 text-center text-xs">
                {pv ? "فارغ — سيُبنى مع خطواتك" : "لا أحداث"}
              </div>
            ) : (
              <DayColumn
                evs={unitEvs}
                isCur={isCur}
                now={now}
                mk={mk}
                em={em}
                dayCount={dayCount}
                taskSlots={TASK_SLOTS()}
                preview={pv}
                onOpen={onOpen}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
