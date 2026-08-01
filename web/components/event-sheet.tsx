"use client"

import { useState } from "react"
import { CheckIcon, PlusIcon, Share2Icon, Trash2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { checklistLines, dotColor, fmt12, fmtDateLong, dateOf, timeOf } from "@/lib/format"
import { WorkoutSheet } from "@/components/workout-sheet"
import { shareEventImage } from "@/lib/share"
import {
  addTask,
  checksFor,
  isAutoDone,
  planFor,
  removeTask,
  sessionProgress,
  setsDoneCount,
  tasksFor,
  toggleCheck,
  toggleDone,
  type Ev,
} from "@/lib/store"
import { arab } from "@/lib/engine/dates.js"

export function EventSheet({ ev, onClose }: { ev: Ev | null; onClose: () => void }) {
  const [taskText, setTaskText] = useState("")
  if (!ev) return <Sheet open={false}>{null}</Sheet>

  const lines = checklistLines(ev.desc)
  const items = lines.filter((l) => l.item)
  const checked = new Set(checksFor(ev.id))
  const doneItems = items.filter((l) => checked.has(l.idx)).length
  const isWorkTasks = ev.slot === "work1" && !ev.external && ev.title === "عمل"
  const isWorkout = ev.slot === "train" && !ev.external && ev.title.startsWith("تمرين")
  const auto = isAutoDone(ev) // اكتمل ببنوده فلا حاجة لزر الإنجاز
  // زر الحذف لمهامك اليدوية فقط — بنود Google المدموجة تُدار من تقويم Google نفسه
  const manualTaskCount = isWorkTasks ? tasksFor(ev.unit!).length : 0

  const submitTask = () => {
    const t = taskText.trim()
    if (!t) return
    addTask(ev.unit!, t)
    setTaskText("")
  }

  return (
    <Sheet open={!!ev} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-0">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <span className={cn("size-3 flex-none rounded-full", dotColor(ev.colorId, ev.external))} />
            {ev.title}
          </SheetTitle>
          <div className="text-muted-foreground text-sm">
            {fmtDateLong(dateOf(ev.start))} ⋅ {fmt12(timeOf(ev.start))} – {fmt12(timeOf(ev.end))}
            {ev.external && (
              <span className="ms-2 text-sky-600">
                من Google{ev.account ? ` — ${ev.account}` : ""} (عرض فقط)
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4 pb-6">
          {isWorkout && <WorkoutSheet date={ev.unit!} />}

          {!isWorkout && items.length > 0 && (
            <Progress value={(doneItems / items.length) * 100} className="h-1.5" />
          )}

          {!isWorkout && lines.length > 0 && (
            <div className="flex flex-col gap-1">
              {lines.map((l) =>
                l.item && !ev.external ? (
                  <label
                    key={l.idx}
                    className={cn(
                      "hover:bg-muted flex cursor-pointer items-start gap-3 rounded-md p-2 text-sm",
                      checked.has(l.idx) && "text-muted-foreground line-through"
                    )}
                  >
                    <Checkbox
                      checked={checked.has(l.idx)}
                      onCheckedChange={() => toggleCheck(ev.id, l.idx)}
                      className="mt-0.5"
                    />
                    <span className="leading-relaxed">{l.text}</span>
                    {isWorkTasks && l.idx < manualTaskCount && (
                      <button
                        onClick={(e2) => {
                          e2.preventDefault()
                          // في بلوك المهام كل سطر = مهمة، ففهرس السطر هو فهرس المهمة
                          removeTask(ev.unit!, l.idx)
                        }}
                        className="text-muted-foreground hover:text-destructive ms-auto"
                        aria-label="حذف المهمة"
                      >
                        <Trash2Icon className="size-3.5" />
                      </button>
                    )}
                  </label>
                ) : (
                  <p key={l.idx} className="text-muted-foreground p-1 text-xs leading-relaxed">
                    {l.text}
                  </p>
                )
              )}
            </div>
          )}

          {isWorkTasks && (
            <div className="flex gap-2">
              <Input
                value={taskText}
                onChange={(e2) => setTaskText(e2.target.value)}
                onKeyDown={(e2) => e2.key === "Enter" && submitTask()}
                placeholder="أضف مهمة عمل…"
              />
              <Button size="icon" onClick={submitTask} aria-label="إضافة">
                <PlusIcon />
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            {!ev.external &&
              (auto ? (
                <div className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-emerald-600/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckIcon className="size-4" />
                  اكتمل تلقائيًا — أُنجزت كل بنوده
                </div>
              ) : (
                <Button
                  className="flex-1"
                  variant={ev.done ? "secondary" : "default"}
                  onClick={() => {
                    toggleDone(ev.id)
                    onClose()
                  }}
                >
                  <CheckIcon />
                  {ev.done ? "تراجع عن الإنجاز" : "إنجاز الحدث كاملًا"}
                </Button>
              ))}
            <Button
              variant="outline"
              className="flex-1 border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
              onClick={() => {
                if (isWorkout) {
                  const plan = planFor(ev.unit!)
                  const lines = (plan?.items || []).map((it) => {
                    const n = setsDoneCount(ev.unit!, it)
                    const detail =
                      it.kind === "reps"
                        ? ` — ${arab(it.reps!)} عدات @ ${it.weight == null ? "—" : `${arab(it.weight)} كجم`}`
                        : it.kind === "hold"
                          ? ` — ${arab(it.seconds!)} ث`
                          : ""
                    return `${n >= it.sets ? "✅" : "⬜"} ${it.name}${detail} (${arab(n)}/${arab(it.sets)})`
                  })
                  shareEventImage(ev, new Set(), { prog: sessionProgress(ev.unit!), lines })
                } else {
                  shareEventImage(ev, new Set(checksFor(ev.id)))
                }
              }}
            >
              <Share2Icon />
              مشاركة واتساب
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
