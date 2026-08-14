"use client"

import { CircleAlertIcon, CircleDotIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { arab } from "@/lib/engine/dates.js"
import { barColor, checklistLines, durMin, fmt12, fmtDur, timeOf } from "@/lib/format"
import { checksFor, isMissed, lateCount, sessionProgress, type Ev } from "@/lib/store"

export function EventChip({
  ev,
  current,
  now,
  makeupCount = 0,
  onOpen,
}: {
  ev: Ev
  current: boolean
  now: string
  makeupCount?: number
  onOpen: (ev: Ev) => void
}) {
  // التمرين يعرض تقدّم الجلسات، وبقية البلوكات تعرض بنودها المؤشَّرة
  const isWorkout = ev.slot === "train" && !ev.external && ev.title.startsWith("تمرين")
  const sess = isWorkout ? sessionProgress(ev.trainDate ?? ev.unit!) : null
  const lines = isWorkout ? [] : checklistLines(ev.desc).filter((l) => l.item)
  const checked = new Set(checksFor(ev.id))
  const total = isWorkout ? sess!.total : lines.length
  const doneItems = isWorkout ? sess!.done : lines.filter((l) => checked.has(l.idx)).length
  const missed = isMissed(ev, now)
  const lates = isWorkout ? 0 : lateCount(ev)
  const halfDone = ev.done && lates > 0 // أُنجز لكن بعضه قضاءً
  const quiet = ev.slot?.startsWith("sleep") || ev.slot === "nap" || ev.slot === "rest"

  return (
    <button
      onClick={() => onOpen(ev)}
      className={cn(
        "relative w-full rounded-md p-2 ps-5 text-start text-sm transition-colors",
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
        <span className="truncate">{ev.title}</span>
      </div>
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <span>
          {fmt12(timeOf(ev.start))} – {fmt12(timeOf(ev.end))}
        </span>
        <span className="opacity-70">{fmtDur(durMin(ev))}</span>
        {total > 0 && (
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
        {makeupCount > 0 && !missed && (
          <span className="rounded bg-amber-500/15 px-1 font-medium text-amber-600 dark:text-amber-400">
            قضاء {arab(makeupCount)}
          </span>
        )}
        {ev.external && <span className="text-sky-600">Google</span>}
      </div>
    </button>
  )
}
