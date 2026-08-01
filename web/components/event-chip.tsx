"use client"

import { cn } from "@/lib/utils"
import { arab } from "@/lib/engine/dates.js"
import { barColor, checklistLines, fmt12, timeOf } from "@/lib/format"
import { checksFor, sessionProgress, type Ev } from "@/lib/store"

export function EventChip({
  ev,
  current,
  onOpen,
}: {
  ev: Ev
  current: boolean
  onOpen: (ev: Ev) => void
}) {
  // التمرين يعرض تقدّم الجلسات، وبقية البلوكات تعرض بنودها المؤشَّرة
  const isWorkout = ev.slot === "train" && !ev.external && ev.title.startsWith("تمرين")
  const sess = isWorkout ? sessionProgress(ev.unit!) : null
  const items = isWorkout
    ? Array.from({ length: sess!.total })
    : checklistLines(ev.desc).filter((l) => l.item)
  const checked = new Set(checksFor(ev.id))
  const doneItems = isWorkout
    ? sess!.done
    : checklistLines(ev.desc).filter((l) => l.item && checked.has(l.idx)).length
  const quiet = ev.slot?.startsWith("sleep") || ev.slot === "nap" || ev.slot === "rest"

  return (
    <button
      onClick={() => onOpen(ev)}
      className={cn(
        "relative w-full rounded-md p-2 ps-5 text-start text-sm transition-colors",
        "after:absolute after:inset-y-2 after:start-2 after:w-1 after:rounded-full",
        barColor(ev.colorId, ev.external),
        quiet ? "bg-muted/40 text-muted-foreground" : "bg-muted hover:bg-accent",
        ev.done && "opacity-55",
        current && "ring-2 ring-red-500/70"
      )}
    >
      <div className={cn("font-medium leading-tight", ev.done && "line-through")}>
        {ev.done && "✓ "}
        {ev.title}
      </div>
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <span>
          {fmt12(timeOf(ev.start))} – {fmt12(timeOf(ev.end))}
        </span>
        {items.length > 0 && (
          <span className={cn(doneItems === items.length && "text-emerald-600")}>
            {arab(doneItems)}/{arab(items.length)}
          </span>
        )}
        {ev.external && <span className="text-sky-600">Google</span>}
      </div>
    </button>
  )
}
