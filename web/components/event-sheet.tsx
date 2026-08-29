"use client"

import { useState } from "react"
import {
  CheckIcon,
  CircleAlertIcon,
  ClockAlertIcon,
  FlagIcon,
  DumbbellIcon,
  FastForwardIcon,
  ListChecksIcon,
  PlusIcon,
  Share2Icon,
  Trash2Icon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { dotColor, fmt12, fmtDateLong, dateOf, timeOf } from "@/lib/format"
import { WorkoutSheet } from "@/components/workout-sheet"
import { shareEventImage } from "@/lib/share"
import {
  addTask,
  checkable,
  checksFor,
  completeGoal,
  dayTasks,
  earlyMap,
  hasOldMistakes,
  isAutoDone,
  isLate,
  isMissed,
  makeupMap,
  nowStamp,
  removeTask,
  TASK_SLOTS,
  tasksFor,
  isDone,
  toggleCheck,
  toggleDone,
  type DayTask,
  type Early,
  type Ev,
  type Makeup,
} from "@/lib/store"
import { arab } from "@/lib/engine/dates.js"

export function EventSheet({
  ev,
  events,
  onClose,
  onOpen,
}: {
  ev: Ev | null
  events: Ev[]
  onClose: () => void
  onOpen?: (ev: Ev) => void
}) {
  const [taskText, setTaskText] = useState("")
  const [openTrain, setOpenTrain] = useState<string | null>(null)
  if (!ev) return <Sheet open={false}>{null}</Sheet>

  const items = checkable(ev)
  const checked = new Set(checksFor(ev.id))
  const doneItems = items.filter((i) => checked.has(i.id)).length
  // المهام اليدوية تُضاف في بلوكات العمل والأسرة والراحة
  const isTaskHost = !ev.external && TASK_SLOTS().includes(ev.slot || "")
  const auto = isAutoDone(ev) // اكتمل ببنوده فلا حاجة لزر الإنجاز

  // القضاء: البلوك الفائت مقفل وبنوده تظهر في بلوك العمل القادم
  const now = nowStamp()
  const missed = isMissed(ev, now)
  const map = makeupMap(events, now)
  const makeups: Makeup[] = map.get(ev.id) || []
  // التقديم: بنود بلوكات لاحقة من الوحدة نفسها يمكن أداؤها هنا
  const earlies: Early[] = earlyMap(events, now).get(ev.id) || []
  // مهمتا اليوم (القرآن والتمرين/التطوير) تظهران في كل بلوك مهام — والقرآن أصلًا داخل بلوكه
  const today: DayTask[] = isTaskHost
    ? dayTasks(events, ev.unit!).filter((g) => !(g.kind === "quran" && g.srcId === ev.id))
    : []
  const pendingHere = missed ? items.filter((i) => !checked.has(i.id)) : []
  let destTitle = ""
  if (missed && pendingHere.length) {
    for (const [destId, list] of map)
      if (list.some((m) => m.srcId === ev.id)) {
        const dest = events.find((e) => e.id === destId)
        if (dest) destTitle = `${dest.title} ${fmt12(timeOf(dest.start))}`
        break
      }
  }

  const submitTask = () => {
    const t = taskText.trim()
    if (!t) return
    addTask(ev.unit!, ev.slot!, t)
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
          {/* بلوك فات وقته: مقفل، وبنوده انتقلت إلى بلوك العمل القادم */}
          {missed && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400">
                <CircleAlertIcon className="size-4" />
                فات وقت هذا البلوك
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {pendingHere.length === 0
                  ? "لا بنود معلّقة."
                  : destTitle
                    ? `انتقل ${arab(pendingHere.length)} من بنوده غير المنجزة إلى «${destTitle}» — أشّرها هناك قضاءً، وستُحتسب نصف إنجاز ½.`
                    : `انقضى يومه و${arab(pendingHere.length)} من بنوده لم تُنجز — لا يمكن قضاؤها الآن. اجعل غدك أفضل.`}
              </p>
            </div>
          )}

          {items.length > 0 && (
            <Progress value={(doneItems / items.length) * 100} className="h-1.5" />
          )}

          {ev.items.length > 0 && (
            <div className="flex flex-col gap-1">
              {ev.items.map((l, li) => {
                if (l.note || ev.external)
                  return (
                    <p key={l.id} className="text-muted-foreground p-1 text-xs leading-relaxed">
                      {l.text}
                    </p>
                  )
                // مجمع الأخطاء يُستخدم هنا لقاعدة نصف الإنجاز فقط — إدخال الأخطاء صار في صفحة الإحصاءات
                const pool = l.pool
                const num = ev.items.slice(0, li).filter((x) => !x.note).length + 1
                return (
                  <div key={l.id} className="flex flex-col gap-1" style={l.depth ? { marginInlineStart: l.depth * 22 } : undefined}>
                    <label
                      className={cn(
                        "flex items-start gap-3 rounded-md p-2 text-sm",
                        missed ? "opacity-60" : "hover:bg-muted cursor-pointer",
                        checked.has(l.id) && "text-muted-foreground line-through"
                      )}
                    >
                      <Checkbox
                        checked={checked.has(l.id)}
                        disabled={missed}
                        onCheckedChange={() => {
                          const checking = !checked.has(l.id)
                          const asMakeup = checking && !!pool && hasOldMistakes(pool)
                          toggleCheck(ev.id, l.id, asMakeup)
                        }}
                        className="mt-0.5"
                      />
                      {isLate(ev.id, l.id) && (
                        <span className="mt-0.5 flex-none text-xs text-amber-500" title="نصف إنجاز">
                          ½
                        </span>
                      )}
                      <span className="leading-relaxed">
                        {!l.depth && <span className="text-muted-foreground me-1">{arab(num)}.</span>}
                        {l.text}
                        {l.hint && (
                          <span className="text-muted-foreground/70 block text-[11px] no-underline">
                            {l.hint}
                          </span>
                        )}
                      </span>
                      {l.cabItemId && !l.depth && (
                        <button
                          onClick={(e2) => {
                            e2.preventDefault()
                            completeGoal("items", l.cabItemId!)
                          }}
                          className="text-muted-foreground hover:text-emerald-600 ms-auto flex-none"
                          title="إتمام الهدف — تختفي المهمة من الجدول"
                          aria-label="إتمام الهدف"
                        >
                          <FlagIcon className="size-3.5" />
                        </button>
                      )}
                      {l.taskId && (
                        <button
                          onClick={(e2) => {
                            e2.preventDefault()
                            removeTask(ev.unit!, ev.slot!, l.taskId!)
                          }}
                          className="text-muted-foreground hover:text-destructive ms-auto"
                          aria-label="حذف المهمة"
                        >
                          <Trash2Icon className="size-3.5" />
                        </button>
                      )}
                    </label>
                  </div>
                )
              })}
            </div>
          )}

          {/* مهام اليوم: القرآن والتمرين — تظهران في كل بلوك مهام حتى تُنجزا */}
          {today.length > 0 && !missed && (
            <div className="rounded-lg border border-emerald-600/40 bg-emerald-500/5 p-2">
              <div className="mb-1 flex items-center gap-1.5 px-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <ListChecksIcon className="size-4" />
                مهام اليوم — {arab(today.length)}
              </div>
              <div className="flex flex-col gap-1">
                {today.map((g) => {
                  if (g.kind === "quran")
                    return (
                      <div key="quran" className="rounded-md border border-emerald-600/30 p-1">
                        <div className="px-1 pb-1 text-xs font-medium">القرآن</div>
                        {g.lines.map((l) => (
                          <label
                            key={l.itemId}
                            className="hover:bg-muted flex cursor-pointer items-start gap-3 rounded-md p-2 text-sm"
                          >
                            <Checkbox
                              checked={false}
                              onCheckedChange={() => toggleCheck(g.srcId, l.itemId, false)}
                              className="mt-0.5"
                            />
                            <span className="leading-relaxed">{l.text}</span>
                          </label>
                        ))}
                      </div>
                    )
                  if (g.kind === "dev")
                    return (
                      <label
                        key={g.id}
                        className="hover:bg-muted flex cursor-pointer items-start gap-3 rounded-md p-2 text-sm"
                      >
                        <Checkbox
                          checked={isDone(g.id)}
                          onCheckedChange={() => toggleDone(g.id)}
                          className="mt-0.5"
                        />
                        <span className="leading-relaxed">{g.title}</span>
                      </label>
                    )
                  return (
                    <div key={g.date} className="flex flex-col gap-1">
                      <button
                        onClick={() => setOpenTrain(openTrain === g.date ? null : g.date)}
                        className="hover:bg-muted flex items-center gap-3 rounded-md border border-emerald-600/30 p-2 text-start text-sm"
                      >
                        <DumbbellIcon className="size-4 flex-none text-emerald-600" />
                        <span className="leading-relaxed">
                          {g.title} — {arab(g.done)}/{arab(g.total)} جلسة
                          {g.carried ? " (قضاء أمس)" : ""}
                        </span>
                      </button>
                      {openTrain === g.date && <WorkoutSheet date={g.date} />}
                    </div>
                  )
                })}
              </div>
              <p className="text-muted-foreground px-1 pt-1 text-[11px]">
                مهمتا يومك تظهران في كل بلوك مهام — أدّهما في أيّها شئت، وما تُنجزه يختفي من البقية.
              </p>
            </div>
          )}

          {/* قضاء: بنود فاتت أوقاتها وانتقلت إلى هذا البلوك */}
          {makeups.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2">
              <div className="mb-1 flex items-center gap-1.5 px-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                <ClockAlertIcon className="size-4" />
                قضاء — {arab(makeups.length)} بند فات وقته
              </div>
              <div className="flex flex-col gap-1">
                {makeups.map((m) => {
                  if (m.kind === "train") {
                    // بطاقة التمرين الفائت: تُفتح وتُكمل جلساته قضاءً
                    const trainEv = events.find((e2) => e2.id === m.srcId)
                    return (
                      <button
                        key={m.srcId}
                        onClick={() => trainEv && onOpen?.(trainEv)}
                        className="hover:bg-muted flex items-center gap-3 rounded-md border border-amber-500/30 p-2 text-start text-sm"
                      >
                        <DumbbellIcon className="size-4 flex-none text-amber-600" />
                        <span className="leading-relaxed">{m.text}</span>
                      </button>
                    )
                  }
                  const on = checksFor(m.srcId).includes(m.itemId)
                  return (
                    <label
                      key={`${m.srcId}:${m.itemId}`}
                      className={cn(
                        "hover:bg-muted flex cursor-pointer items-start gap-3 rounded-md p-2 text-sm",
                        on && "text-muted-foreground line-through",
                        m.crossDay && "border border-amber-500/30"
                      )}
                    >
                      <Checkbox
                        checked={on}
                        onCheckedChange={() => toggleCheck(m.srcId, m.itemId, true)}
                        className="mt-0.5"
                      />
                      <span className="leading-relaxed">
                        {m.text}
                        <span className="text-muted-foreground/70 me-1 text-xs"> ({m.srcTitle})</span>
                      </span>
                    </label>
                  )
                })}
              </div>
              <p className="text-muted-foreground px-1 pt-1 text-[11px]">
                تأشيرها هنا يؤشّرها في بلوكها الأصلي، وتُحتسب نصف إنجاز ½ لأنها خارج وقتها.
              </p>
            </div>
          )}

          {/* تقديم: بنود بلوكات لاحقة من الوحدة نفسها — أداؤها هنا إنجاز كامل */}
          {earlies.length > 0 && !missed && (
            <div className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-2">
              <div className="mb-1 flex items-center gap-1.5 px-1 text-sm font-medium text-sky-600 dark:text-sky-400">
                <FastForwardIcon className="size-4" />
                تقديم — {arab(earlies.length)} بند من بلوكات لاحقة
              </div>
              <div className="flex flex-col gap-1">
                {earlies.map((m) => {
                  if (m.kind === "train") {
                    const trainEv = events.find((e2) => e2.id === m.srcId)
                    return (
                      <button
                        key={m.srcId}
                        onClick={() => trainEv && onOpen?.(trainEv)}
                        className="hover:bg-muted flex items-center gap-3 rounded-md border border-sky-500/30 p-2 text-start text-sm"
                      >
                        <DumbbellIcon className="size-4 flex-none text-sky-600" />
                        <span className="leading-relaxed">{m.text}</span>
                      </button>
                    )
                  }
                  const on = checksFor(m.srcId).includes(m.itemId)
                  return (
                    <label
                      key={`${m.srcId}:${m.itemId}`}
                      className={cn(
                        "hover:bg-muted flex cursor-pointer items-start gap-3 rounded-md p-2 text-sm",
                        on && "text-muted-foreground line-through"
                      )}
                    >
                      <Checkbox
                        checked={on}
                        onCheckedChange={() => toggleCheck(m.srcId, m.itemId, false)}
                        className="mt-0.5"
                      />
                      <span className="leading-relaxed">
                        {m.text}
                        <span className="text-muted-foreground/70 me-1 text-xs"> ({m.srcTitle})</span>
                      </span>
                    </label>
                  )
                })}
              </div>
              <p className="text-muted-foreground px-1 pt-1 text-[11px]">
                هذه بنود بلوكات لم يحن وقتها بعد — أداؤها الآن يؤشّرها في بلوكها ويُحتسب إنجازًا كاملًا.
              </p>
            </div>
          )}

          {isTaskHost && (
            <div className="flex gap-2">
              <Input
                value={taskText}
                onChange={(e2) => setTaskText(e2.target.value)}
                onKeyDown={(e2) => e2.key === "Enter" && submitTask()}
                placeholder={`أضف مهمة في «${ev.title}»…`}
              />
              <Button size="icon" onClick={submitTask} aria-label="إضافة">
                <PlusIcon />
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            {!ev.external &&
              !missed &&
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
              onClick={() => shareEventImage(ev, new Set(checksFor(ev.id)))}
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
