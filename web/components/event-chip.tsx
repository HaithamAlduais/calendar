"use client"

import { CircleAlertIcon, CircleDotIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { arab } from "@/lib/engine/dates.js"
import { barColor, durMin, fmt12, fmtDur, timeOf } from "@/lib/format"
import { checkable, checksFor, isMissed, lateCount, type Ev } from "@/lib/store"

export function EventChip({
  ev,
  current,
  now,
  makeupCount = 0,
  earlyCount = 0,
  dayCount = 0,
  preview = false,
  grow = false,
  onOpen,
}: {
  ev: Ev
  current: boolean
  now: string
  makeupCount?: number
  earlyCount?: number
  dayCount?: number
  preview?: boolean
  grow?: boolean
  onOpen: (ev: Ev) => void
}) {
  const items = checkable(ev)
  const checked = new Set(checksFor(ev.id))
  const total = items.length
  const doneItems = items.filter((i) => checked.has(i.id)).length
  const missed = !preview && isMissed(ev, now)
  const lates = lateCount(ev)
  const halfDone = ev.done && lates > 0 // أُنجز لكن بعضه قضاءً
  const quiet = ev.slot?.startsWith("sleep") || ev.slot === "nap" || ev.slot === "rest"

  return (
    <button
      onClick={() => onOpen(ev)}
      className={cn(
        "relative w-full rounded-md p-2 ps-5 text-start text-sm transition-colors",
        grow && "flex flex-1 flex-col justify-center",
        "after:absolute after:inset-y-2 after:start-2 after:w-1 after:rounded-full",
        missed ? "after:bg-red-500" : barColor(ev.colorId, ev.external),
        missed
          ? "border border-red-500/50 bg-red-500/10"
          : quiet
            ? "bg-muted/40 text-muted-foreground"
            : "bg-muted hover:bg-accent",
        ev.done && !missed && "opacity-55",
        current && !missed && "ring-2 ring-red-500/70"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1 font-medium leading-tight",
          ev.done && !halfDone && "line-through",
          missed && "text-red-600 dark:text-red-400"
        )}
      >
        {missed && <CircleAlertIcon className="size-3.5 flex-none" />}
        {halfDone && <CircleDotIcon className="size-3.5 flex-none text-amber-500" />}
        {ev.done && !halfDone && "✓ "}
        <span className="min-w-0 truncate">{ev.title}</span>
      </div>
      {/* سطر التفاصيل يلتفّ قطعةً قطعةً: كل قطعة لا تُكسر في نفسها ولو ضاق العمود */}
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs [&>*]:whitespace-nowrap">
        <span>
          {fmt12(timeOf(ev.start))} – {fmt12(timeOf(ev.end))}
        </span>
        <span className="opacity-70">{fmtDur(durMin(ev))}</span>
        {total > 0 && !preview && (
          <span
            className={cn(
              missed && "text-red-600 dark:text-red-400",
              !missed && doneItems === total && (halfDone ? "text-amber-500" : "text-emerald-600")
            )}
          >
            {arab(doneItems)}/{arab(total)}
            {halfDone && " ½"}
          </span>
        )}
        {missed && <span className="text-red-600 dark:text-red-400">فات وقته</span>}
        {dayCount > 0 && !missed && !preview && (
          <span className="rounded bg-emerald-500/15 px-1 font-medium text-emerald-700 dark:text-emerald-400">
            مهام اليوم {arab(dayCount)}
          </span>
        )}
        {makeupCount > 0 && !missed && (
          <span className="rounded bg-amber-500/15 px-1 font-medium text-amber-600 dark:text-amber-400">
            قضاء {arab(makeupCount)}
          </span>
        )}
        {earlyCount > 0 && !missed && (
          <span className="rounded bg-sky-500/15 px-1 font-medium text-sky-700 dark:text-sky-400">
            تقديم {arab(earlyCount)}
          </span>
        )}
        {ev.external && <span className="text-sky-600">Google</span>}
      </div>
    </button>
  )
}
