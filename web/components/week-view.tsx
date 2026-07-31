"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"
import { addDays, arab, parseIso } from "@/lib/engine/dates.js"
import { dateOf, dayName } from "@/lib/format"
import { todayIso, type Ev } from "@/lib/store"
import { EventChip } from "@/components/event-chip"

function nowHM(): string {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`
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
  const today = todayIso()
  const todayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const center = () =>
      todayRef.current?.scrollIntoView({ inline: "center", block: "nearest" })
    center()
    // عند تدوير الهاتف أو تغيير مقاس النافذة نعيد التمركز على اليوم
    window.addEventListener("resize", center)
    return () => window.removeEventListener("resize", center)
  }, [weekStart])

  const now = nowHM()
  const nowStamp = `${today}T${now}`

  return (
    <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-2 pb-6 sm:grid sm:grid-cols-7 sm:gap-1 sm:overflow-visible sm:px-3">
      {days.map((d) => {
        const isToday = d === today
        const dayEvents = events
          .filter((e) => dateOf(e.start) === d)
          .sort((a, b) => (a.start < b.start ? -1 : 1))
        return (
          <div
            key={d}
            ref={isToday ? todayRef : undefined}
            className="w-[82vw] max-w-80 flex-none snap-center sm:w-auto sm:max-w-none"
          >
            <div className="bg-background/95 sticky top-0 z-10 flex items-center justify-center gap-2 py-2 backdrop-blur">
              <span
                className={cn(
                  "text-muted-foreground text-xs",
                  isToday && "text-primary font-semibold"
                )}
              >
                {dayName(d)}
              </span>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                )}
              >
                {arab(parseIso(d).d)}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {dayEvents.length === 0 && (
                <div className="text-muted-foreground/60 py-8 text-center text-xs">لا أحداث</div>
              )}
              {dayEvents.map((e, i) => {
                const next = dayEvents[i + 1]
                const nowHere =
                  isToday && e.start <= nowStamp && (!next || next.start > nowStamp)
                return (
                  <div key={e.id} className="flex flex-col gap-1.5">
                    <EventChip
                      ev={e}
                      current={isToday && e.start <= nowStamp && e.end > nowStamp}
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
          </div>
        )
      })}
    </div>
  )
}
