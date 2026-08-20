"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"
import { addDays, arab, parseIso } from "@/lib/engine/dates.js"
import { dayName } from "@/lib/format"
import { currentUnit, dayTasks, makeupMap, nowStamp, TASK_SLOTS, type Ev } from "@/lib/store"
import { EventChip } from "@/components/event-chip"

// شطر الليل من الوحدة: من المغرب إلى فجر الغد
const NIGHT_SLOTS = new Set(["maghrib", "sleep1", "isha", "family", "rest", "qiyam", "sleep2"])

function Section({
  label,
  icon,
  night,
  chips,
  isCur,
  now,
  mk,
  dayCount,
  onOpen,
}: {
  label: string
  icon: string
  night: boolean
  chips: Ev[]
  isCur: boolean
  now: string
  mk: Map<string, unknown[]>
  dayCount: number
  onOpen: (ev: Ev) => void
}) {
  if (!chips.length) return null
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-xl p-1.5",
        night ? "bg-indigo-500/10 dark:bg-indigo-400/10" : "bg-amber-500/10 dark:bg-amber-300/5"
      )}
    >
      <div className="text-muted-foreground py-0.5 text-center text-[10px]">
        {icon} {label}
      </div>
      {chips.map((e, i) => {
        const next = chips[i + 1]
        const nowHere = isCur && e.start <= now && (!next || next.start > now) && e.end > now
        const nowAfter = isCur && e.end <= now && (!next || next.start > now) && false
        void nowAfter
        return (
          <div key={e.id} className="flex flex-col gap-1.5">
            <EventChip
              ev={e}
              now={now}
              current={isCur && e.start <= now && e.end > now}
              makeupCount={mk.get(e.id)?.length || 0}
              dayCount={TASK_SLOTS.includes(e.slot || "") && !e.external ? dayCount : 0}
              onOpen={onOpen}
            />
            {nowHere && (
              <div className="flex items-center gap-1" aria-label="الآن">
                <span className="size-2 rounded-full bg-red-500" />
                <span className="h-px flex-1 bg-red-500" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

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
  const mk = makeupMap(events, now) // شارة «قضاء N» على البلوكات المستقبِلة

  return (
    <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-2 pb-6 sm:grid sm:grid-cols-7 sm:gap-1 sm:overflow-visible sm:px-3">
      {days.map((d) => {
        const isCur = d === cu
        // عمود اليوم = وحدته كاملة من الفجر إلى فجر الغد: نهاره ثم ليلته
        const unitEvs = events
          .filter((e) => e.unit === d)
          .sort((a, b) => (a.start < b.start ? -1 : 1))
        const dayCount = dayTasks(unitEvs, d).length // مهمتا القرآن والتمرين ما لم تُنجزا
        const dayPart = unitEvs.filter((e) => !NIGHT_SLOTS.has(e.slot || ""))
        const nightPart = unitEvs.filter((e) => NIGHT_SLOTS.has(e.slot || ""))
        return (
          <div
            key={d}
            ref={isCur ? curRef : undefined}
            className="w-[82vw] max-w-80 flex-none snap-center sm:w-auto sm:max-w-none"
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
              <div className="text-muted-foreground/60 py-8 text-center text-xs">لا أحداث</div>
            ) : (
              <div className="flex flex-col gap-2">
                <Section label="نهارك — من الفجر إلى المغرب" icon="☀️" night={false} chips={dayPart} isCur={isCur} now={now} mk={mk} dayCount={dayCount} onOpen={onOpen} />
                <Section label="ليلتك — من المغرب إلى الفجر" icon="🌙" night chips={nightPart} isCur={isCur} now={now} mk={mk} dayCount={dayCount} onOpen={onOpen} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
