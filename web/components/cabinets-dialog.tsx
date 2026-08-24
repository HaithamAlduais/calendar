"use client"

import { useState } from "react"
import { ChevronDownIcon, FlagIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Help } from "@/components/help"
import { arab, DAY_NAMES } from "@/lib/format"
import {
  addCabItem,
  addCabinet,
  addDrawer,
  cabinetsData,
  completeGoal,
  currentUnit,
  removeCab,
  reopenGoal,
  updateCab,
  repeatLabel,
  taskBlocksOf,
  type CabItem,
  type Ev,
  type Repeat,
} from "@/lib/store"
import { fmt12, timeOf } from "@/lib/format"

// صفّ صغير من أزرار — يستعمله اختيار البلوك واختيار أيام الأسبوع
function Chips({
  options,
  value,
  onPick,
}: {
  options: { key: string; label: string }[]
  value: (k: string) => boolean
  onPick: (k: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onPick(o.key)}
          className={cn(
            "rounded-md border px-2 py-1 text-xs transition-colors",
            value(o.key)
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:bg-muted"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// محرِّر المهمة: العنوان أولًا، والتفاصيل خلف زر — أقلّ نقرات وأقلّ ضجيج
function ItemForm({
  blocks,
  onAdd,
  onCancel,
}: {
  blocks: { slot: string; title: string; start: string }[]
  onAdd: (title: string, patch: Partial<CabItem>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState("")
  const [slot, setSlot] = useState(blocks[0]?.slot || "")
  const [more, setMore] = useState(false)
  const [mode, setMode] = useState<"once" | "weekly" | "everyN">("once")
  const [days, setDays] = useState<number[]>([])
  const [everyN, setEveryN] = useState(2)
  const [from, setFrom] = useState(currentUnit())
  const [deadline, setDeadline] = useState("")

  const submit = () => {
    const t = title.trim()
    if (!t) return
    const repeat: Repeat =
      mode === "weekly" ? { mode, days } : mode === "everyN" ? { mode, n: everyN } : { mode: "once" }
    onAdd(t, { slot, repeat, from, deadline: deadline || undefined })
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-2">
      <div className="flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="اسم المهمة…"
          autoFocus
        />
        <Button size="icon" onClick={submit} aria-label="إضافة المهمة">
          <PlusIcon />
        </Button>
      </div>

      <div className="flex items-center gap-1 text-xs">
        <span className="text-muted-foreground">في بلوك</span>
        <Help text="المهمة توضع في بلوك مهام بعينه من جدولك — ولا يمكن وضعها خارج بلوكات المهام." />
      </div>
      <Chips
        options={blocks.map((b) => ({ key: b.slot, label: `${b.title} ${fmt12(timeOf(b.start))}` }))}
        value={(k) => k === slot}
        onPick={setSlot}
      />

      {!more ? (
        <button onClick={() => setMore(true)} className="text-primary self-start text-xs">
          تكرار وتواريخ…
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">التكرار</span>
            <Help text="مقيّد بالأسبوع: تختار أيامه. غير مقيّد: كل كم يوم — «كل يومين» تعني يومًا بعد يوم، فلا تتعلّق بأيام الأسبوع." />
          </div>
          <Chips
            options={[
              { key: "once", label: "مرة واحدة" },
              { key: "weekly", label: "أيام الأسبوع" },
              { key: "everyN", label: "كل كم يوم" },
            ]}
            value={(k) => k === mode}
            onPick={(k) => setMode(k as typeof mode)}
          />
          {mode === "weekly" && (
            <Chips
              options={DAY_NAMES.map((d, i) => ({ key: String(i), label: d }))}
              value={(k) => days.includes(+k)}
              onPick={(k) =>
                setDays((prev) => (prev.includes(+k) ? prev.filter((x) => x !== +k) : [...prev, +k]))
              }
            />
          )}
          {mode === "everyN" && (
            <div className="flex items-center gap-2 text-sm">
              <Button variant="outline" size="sm" onClick={() => setEveryN((v) => Math.max(1, v - 1))}>
                −
              </Button>
              <span className="w-28 text-center text-xs">
                كل {arab(everyN)} {everyN === 1 ? "يوم" : "أيام"}
              </span>
              <Button variant="outline" size="sm" onClick={() => setEveryN((v) => Math.min(60, v + 1))}>
                +
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-muted-foreground flex-none text-xs">من</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8" />
            <label className="text-muted-foreground flex-none text-xs">حتى</label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="h-8"
            />
            <Help text="اتركه فارغًا فتَرِث المهمة موعدَ الدرج، ثم موعدَ الخزانة — وإن لم يكن ثمة موعد استمرّت حتى تضغط «إتمام الهدف»." />
          </div>
        </div>
      )}
      <button onClick={onCancel} className="text-muted-foreground self-start text-xs">
        إلغاء
      </button>
    </div>
  )
}

// نموذج خزانة أو درج: الاسم، والهدف والموعد اختياريان
function GoalForm({
  label,
  onAdd,
  onCancel,
}: {
  label: string
  onAdd: (name: string, patch: { goal?: string; deadline?: string }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const [goal, setGoal] = useState("")
  const [deadline, setDeadline] = useState("")
  const submit = () => {
    const t = name.trim()
    if (!t) return
    onAdd(t, { goal: goal.trim() || undefined, deadline: deadline || undefined })
  }
  return (
    <div className="flex flex-col gap-2 rounded-md border p-2">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={label}
          autoFocus
        />
        <Button size="icon" onClick={submit} aria-label="إضافة">
          <PlusIcon />
        </Button>
      </div>
      <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="الهدف (اختياري)" className="h-8" />
      <div className="flex items-center gap-2">
        <label className="text-muted-foreground flex-none text-xs">موعد الإنجاز (اختياري)</label>
        <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-8" />
      </div>
      <button onClick={onCancel} className="text-muted-foreground self-start text-xs">
        إلغاء
      </button>
    </div>
  )
}

// صفّ مهمة في الدرج: اسمُها يُحرَّر، ومهامُها الفرعية تُضاف وتُحذف.
// وكانت المهام الفرعية في النموذج ولا سبيل إلى صنعها، وكان updateCab بلا مستدعٍ
// فلا يُصحَّح خطأٌ في اسمٍ إلا بحذف المهمة وإنشائها من جديد.
function ItemRow({ item, blocks }: { item: CabItem; blocks: { slot: string; title: string }[] }) {
  const [open, setOpen] = useState(false)
  const [sub, setSub] = useState("")
  const subs = item.subtasks || []
  return (
    <div className={cn("rounded-md border p-1.5 text-xs", item.doneAt && "opacity-60")}>
      <div className="flex items-start gap-1">
        <button onClick={() => setOpen((v) => !v)} className="flex flex-1 items-start gap-1 text-start">
          <ChevronDownIcon className={cn("mt-0.5 size-3.5 flex-none transition-transform", !open && "-rotate-90")} />
          <span className="flex-1 leading-relaxed">
            <span className={cn(item.doneAt && "line-through")}>{item.title}</span>
            <span className="text-muted-foreground/80 block text-[11px]">
              {[
                blocks.find((b) => b.slot === item.slot)?.title,
                repeatLabel(item.repeat, arab),
                subs.length ? `${arab(subs.length)} خطوة` : null,
                item.deadline && `حتى ${item.deadline}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        </button>
        <button
          onClick={() => (item.doneAt ? reopenGoal("items", item.id) : completeGoal("items", item.id))}
          className="text-muted-foreground hover:text-emerald-600 flex-none"
          aria-label={item.doneAt ? "إعادة فتح" : "إتمام الهدف"}
        >
          {item.doneAt ? <RotateCcwIcon className="size-3.5" /> : <FlagIcon className="size-3.5" />}
        </button>
        <button
          onClick={() => removeCab("items", item.id)}
          className="text-muted-foreground hover:text-destructive flex-none"
          aria-label="حذف المهمة"
        >
          <Trash2Icon className="size-3.5" />
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-1.5 ps-4 pt-2">
          <Input
            defaultValue={item.title}
            onBlur={(e) => {
              const t = e.target.value.trim()
              if (t && t !== item.title) updateCab("items", item.id, { title: t })
            }}
            className="h-8"
          />

          <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
            خطوات المهمة
            <Help text="تقسيم المهمة إلى خطوات تُؤشَّر واحدةً واحدة داخل البلوك — فتُرى الحركة فيها ولو لم تتمّ." />
          </div>
          {subs.map((t) => (
            <div key={t.id} className="flex items-center gap-1">
              <Input
                defaultValue={t.title}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (!v || v === t.title) return
                  updateCab("items", item.id, {
                    subtasks: subs.map((x) => (x.id === t.id ? { ...x, title: v } : x)),
                  })
                }}
                className="h-7 text-[11px]"
              />
              <button
                onClick={() =>
                  updateCab("items", item.id, { subtasks: subs.filter((x) => x.id !== t.id) })
                }
                className="text-muted-foreground hover:text-destructive flex-none"
                aria-label="حذف الخطوة"
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <Input
              value={sub}
              onChange={(e) => setSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || !sub.trim()) return
                updateCab("items", item.id, {
                  subtasks: [...subs, { id: Math.random().toString(36).slice(2, 8), title: sub.trim() }],
                })
                setSub("")
              }}
              placeholder="خطوة جديدة…"
              className="h-7 text-[11px]"
            />
            <Button
              size="icon"
              variant="outline"
              className="size-7"
              aria-label="أضف خطوة"
              onClick={() => {
                if (!sub.trim()) return
                updateCab("items", item.id, {
                  subtasks: [...subs, { id: Math.random().toString(36).slice(2, 8), title: sub.trim() }],
                })
                setSub("")
              }}
            >
              <PlusIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function CabinetsDialog({
  open,
  onClose,
  events,
}: {
  open: boolean
  onClose: () => void
  events: Ev[]
}) {
  const data = cabinetsData()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [addingCab, setAddingCab] = useState(false)
  const [addingDrawer, setAddingDrawer] = useState<string | null>(null)
  const [addingItem, setAddingItem] = useState<string | null>(null)
  const blocks = taskBlocksOf(events, currentUnit())

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[340px] overflow-y-auto sm:w-[420px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            الخزانات
            <Help text="الخزانة أمر جلل تريد إنهاءه: مشروع، سنة دراسية، روتين. وداخلها أدراج، والدرج هدف جزئي. وداخل الدرج مهامك، وكل مهمة توضع في بلوك مهام من جدولك." />
          </SheetTitle>
          <p className="text-muted-foreground text-xs">
            خزانة ← أدراج ← مهام. الهدف والموعد النهائي اختياريان في كل مستوى، والمهمة تَرِث موعد
            درجها ثم موعد خزانتها.
          </p>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4 pb-8">
          {data.cabinets.length === 0 && !addingCab && (
            <p className="text-muted-foreground text-xs leading-relaxed">
              لا خزانات بعد. أنشئ خزانةً لأمرٍ يشغلك — مشروعٍ أو سنةٍ دراسية أو روتينٍ يومي.
            </p>
          )}

          {data.cabinets.map((c) => {
            const drawers = data.drawers.filter((d) => d.cabinetId === c.id)
            const items = data.items.filter((i) => drawers.some((d) => d.id === i.drawerId))
            const doneCount = items.filter((i) => i.doneAt).length
            const isOpen = expanded.has(c.id)
            return (
              <div key={c.id} className={cn("rounded-lg border p-2", c.doneAt && "opacity-60")}>
                <div className="flex items-start gap-1">
                  <button onClick={() => toggle(c.id)} className="flex flex-1 items-start gap-2 text-start">
                    <ChevronDownIcon
                      className={cn("mt-0.5 size-4 flex-none transition-transform", !isOpen && "-rotate-90")}
                    />
                    <span className="flex-1">
                      <span className="text-sm font-semibold">{c.name}</span>
                      {(c.goal || c.deadline) && (
                        <span className="text-muted-foreground block text-[11px]">
                          {[c.goal, c.deadline && `حتى ${c.deadline}`].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    onClick={() => (c.doneAt ? reopenGoal("cabinets", c.id) : completeGoal("cabinets", c.id))}
                    className="text-muted-foreground hover:text-emerald-600 flex-none"
                    aria-label={c.doneAt ? "إعادة فتح" : "إتمام الهدف"}
                    title={c.doneAt ? "إعادة فتح الخزانة" : "إتمام هدف الخزانة"}
                  >
                    {c.doneAt ? <RotateCcwIcon className="size-4" /> : <FlagIcon className="size-4" />}
                  </button>
                  <button
                    onClick={() => removeCab("cabinets", c.id)}
                    className="text-muted-foreground hover:text-destructive flex-none"
                    aria-label="حذف الخزانة"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                </div>

                {items.length > 0 && (
                  <div className="px-1 pt-1">
                    <Progress value={(doneCount / items.length) * 100} className="h-1" />
                    <div className="text-muted-foreground pt-0.5 text-[11px]">
                      أُتمّ {arab(doneCount)} من {arab(items.length)}
                    </div>
                  </div>
                )}

                {isOpen && (
                  <div className="flex flex-col gap-2 ps-5 pt-2">
                    {drawers.map((d) => {
                      const own = data.items.filter((i) => i.drawerId === d.id)
                      return (
                        <div key={d.id} className={cn("rounded-md border p-2", d.doneAt && "opacity-60")}>
                          <div className="flex items-start gap-1">
                            <span className="flex-1">
                              <span className="text-sm font-medium">{d.name}</span>
                              {(d.goal || d.deadline) && (
                                <span className="text-muted-foreground block text-[11px]">
                                  {[d.goal, d.deadline && `حتى ${d.deadline}`].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </span>
                            <button
                              onClick={() => setAddingItem(addingItem === d.id ? null : d.id)}
                              className="text-muted-foreground hover:text-primary flex-none"
                              aria-label="إضافة مهمة"
                            >
                              <PlusIcon className="size-4" />
                            </button>
                            <button
                              onClick={() => (d.doneAt ? reopenGoal("drawers", d.id) : completeGoal("drawers", d.id))}
                              className="text-muted-foreground hover:text-emerald-600 flex-none"
                              aria-label={d.doneAt ? "إعادة فتح" : "إتمام الهدف"}
                            >
                              {d.doneAt ? <RotateCcwIcon className="size-4" /> : <FlagIcon className="size-4" />}
                            </button>
                            <button
                              onClick={() => removeCab("drawers", d.id)}
                              className="text-muted-foreground hover:text-destructive flex-none"
                              aria-label="حذف الدرج"
                            >
                              <Trash2Icon className="size-4" />
                            </button>
                          </div>

                          <div className="flex flex-col gap-1 pt-1">
                            {own.map((i) => (
                              <ItemRow key={i.id} item={i} blocks={blocks} />
                            ))}
                          </div>

                          {addingItem === d.id && (
                            <div className="pt-2">
                              <ItemForm
                                blocks={blocks}
                                onAdd={(title, patch) => {
                                  addCabItem(d.id, title, patch)
                                  setAddingItem(null)
                                }}
                                onCancel={() => setAddingItem(null)}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {addingDrawer === c.id ? (
                      <GoalForm
                        label="اسم الدرج (هدف جزئي)…"
                        onAdd={(name, patch) => {
                          addDrawer(c.id, name, patch)
                          setAddingDrawer(null)
                        }}
                        onCancel={() => setAddingDrawer(null)}
                      />
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setAddingDrawer(c.id)}>
                        <PlusIcon />
                        درج
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {addingCab ? (
            <GoalForm
              label="اسم الخزانة…"
              onAdd={(name, patch) => {
                const id = addCabinet(name, patch)
                setExpanded((p) => new Set(p).add(id))
                setAddingCab(false)
              }}
              onCancel={() => setAddingCab(false)}
            />
          ) : (
            <Button onClick={() => setAddingCab(true)}>
              <PlusIcon />
              خزانة جديدة
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
