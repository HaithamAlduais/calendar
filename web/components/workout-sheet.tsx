"use client"

import { useEffect, useRef, useState } from "react"
import { CheckIcon, LockIcon, RotateCcwIcon, TimerIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { arab } from "@/lib/engine/dates.js"
import {
  cellDone,
  planFor,
  resetWorkout,
  sessionProgress,
  setComplete,
  setsDoneCount,
  toggleCell,
  type PlanItem as Item,
} from "@/lib/store"

const W = (w?: number | null) => (w == null ? "حدّد الوزن" : `${arab(w)} كجم`)

// دائرة جلسة: لمسة واحدة = أنجزتها → يبدأ مؤقت الراحة
function SetDot({
  n,
  done,
  onTap,
}: {
  n: number
  done: boolean
  onTap: () => void
}) {
  return (
    <button
      onClick={onTap}
      aria-label={`الجلسة ${n}`}
      className={cn(
        "flex size-10 flex-none items-center justify-center rounded-full border-2 text-sm font-semibold transition-all active:scale-95",
        done
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-muted-foreground/30 text-muted-foreground"
      )}
    >
      {done ? <CheckIcon className="size-5" /> : arab(n)}
    </button>
  )
}

export function WorkoutSheet({ date }: { date: string }) {
  const plan = planFor(date)
  const [rest, setRest] = useState<{ left: number; total: number; label: string } | null>(null)
  const tickRef = useRef<number | null>(null)

  // مؤقت الراحة التنازلي
  useEffect(() => {
    if (!rest) return
    if (rest.left <= 0) {
      navigator.vibrate?.([200, 100, 200])
      const t = window.setTimeout(() => setRest(null), 2500)
      return () => clearTimeout(t)
    }
    tickRef.current = window.setTimeout(() => setRest((r) => (r ? { ...r, left: r.left - 1 } : null)), 1000)
    return () => {
      if (tickRef.current) clearTimeout(tickRef.current)
    }
  }, [rest])

  if (!plan) return null
  const prog = sessionProgress(date)
  const pct = prog.total ? (prog.done / prog.total) * 100 : 0

  const startRest = (item: Item) => {
    if (!item.rest) return
    navigator.vibrate?.(60)
    setRest({ left: item.rest, total: item.rest, label: item.name })
  }

  const tap = (item: Item, setIdx: number, part?: string) => {
    const wasComplete = setComplete(date, item, setIdx)
    toggleCell(date, item.key, setIdx, part)
    // بدء الراحة عند اكتمال الجلسة (السوبر ست: بعد الطرفين)
    const nowComplete = setComplete(date, item, setIdx)
    if (!wasComplete && nowComplete) startRest(item)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">
          {arab(prog.done)} / {arab(prog.total)} جلسة
        </span>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => resetWorkout(date)}>
          <RotateCcwIcon />
          تصفير
        </Button>
      </div>
      <Progress value={pct} className="h-2" />
      <p className="text-muted-foreground text-xs leading-relaxed">
        التقدّم المزدوج: زد عدة كل جلسة حتى أعلى النطاق، ثم يرتفع الوزن تلقائيًا وتعود لأدناه.
      </p>

      {plan.items.map((item) => {
        const doneSets = setsDoneCount(date, item)
        const complete = doneSets >= item.sets
        return (
          <div
            key={item.key}
            className={cn(
              "rounded-xl border p-3 transition-colors",
              complete ? "border-emerald-600/40 bg-emerald-500/5" : "bg-card"
            )}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-medium">
                  {complete && <CheckIcon className="size-4 flex-none text-emerald-600" />}
                  <span className="truncate">{item.name}</span>
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs">
                  {item.kind === "reps" && (
                    <span className="inline-flex items-center gap-1">
                      {arab(item.sets)} جلسات × {arab(item.reps!)} عدات
                      <span className="text-foreground inline-flex items-center gap-0.5 font-medium">
                        <LockIcon className="size-3" />
                        {W(item.weight)}
                      </span>
                    </span>
                  )}
                  {item.kind === "superset" && (
                    <span>
                      سوبر ست — {arab(item.sets)} جلسات: كل جلسة تتطلب الطرفين
                    </span>
                  )}
                  {item.kind === "failure" && <span>{arab(item.sets)} جلسات حتى الفشل العضلي</span>}
                  {item.kind === "hold" && (
                    <span>
                      {arab(item.sets)} جلسات × {arab(item.seconds!)} ث
                    </span>
                  )}
                  {item.rest > 0 && <span> — راحة {arab(item.rest)}ث</span>}
                </div>
              </div>
            </div>

            {item.kind === "superset" ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: item.sets }, (_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-muted-foreground w-12 flex-none text-xs">
                      جلسة {arab(i + 1)}
                    </span>
                    {(item.parts || []).map((p) => {
                      const on = cellDone(date, item.key, i, p.key)
                      return (
                        <button
                          key={p.key}
                          onClick={() => tap(item, i, p.key)}
                          className={cn(
                            "flex-1 rounded-lg border px-2 py-2 text-xs transition-all active:scale-[.98]",
                            on
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-muted-foreground/30"
                          )}
                        >
                          <div className="font-medium">{p.name}</div>
                          <div className={cn("text-[11px]", on ? "text-white/80" : "text-muted-foreground")}>
                            {arab(p.reps)} × {W(p.weight)}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: item.sets }, (_, i) => (
                  <SetDot key={i} n={i + 1} done={cellDone(date, item.key, i)} onTap={() => tap(item, i)} />
                ))}
              </div>
            )}

            {item.note && (
              <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">{item.note}</p>
            )}
            {item.kind === "reps" && doneSets === item.sets && item.reps! >= (item.hi ?? 99) && (
              <p className="mt-2 text-[11px] font-medium text-emerald-600">
                🎉 بلغت أعلى النطاق — الجلسة القادمة {W((item.weight ?? 0) + (item.inc ?? 0))} × {arab(item.lo ?? 6)} عدات
              </p>
            )}
          </div>
        )
      })}

      {/* مؤقت الراحة العائم */}
      {rest && (
        <div className="bg-background/95 sticky bottom-0 z-20 -mx-1 flex items-center gap-3 rounded-xl border p-3 shadow-lg backdrop-blur">
          <TimerIcon className={cn("size-5 flex-none", rest.left <= 0 ? "text-emerald-600" : "text-primary")} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between">
              <span className="truncate text-xs">راحة — {rest.label}</span>
              <span className={cn("text-lg font-bold tabular-nums", rest.left <= 0 && "text-emerald-600")}>
                {rest.left > 0 ? `${arab(rest.left)} ث` : "ابدأ الجلسة!"}
              </span>
            </div>
            <Progress value={((rest.total - rest.left) / rest.total) * 100} className="mt-1 h-1.5" />
          </div>
          <Button variant="ghost" size="icon" className="size-8 flex-none" aria-label="إلغاء الراحة" onClick={() => setRest(null)}>
            <XIcon />
          </Button>
        </div>
      )}
    </div>
  )
}
