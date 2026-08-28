"use client"

import { useState } from "react"
import { ChevronDownIcon, MinusIcon, PlusIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { MistakeTracker } from "@/components/mistake-tracker"
import { cn } from "@/lib/utils"
import { arab } from "@/lib/engine/dates.js"
import { quranStateFor, reviewHizbs, reviewMax, tathbeetWindow } from "@/lib/engine/quran.js"
import { strengthSnapshot } from "@/lib/engine/workout.js"
import { durMin, fmtDateLong, fmtDur } from "@/lib/format"
import {
  addFood,
  checkable,
  checksFor,
  completedQuranPools,
  currentUnit,
  isLate,
  foodFor,
  mistakesFor,
  resetFood,
  saveSettings,
  settings,
  SCHEDULE_START,
  type Ev,
} from "@/lib/store"

const BINDING_NOTES = [
  "ملاحظات الصلاة: التركيز وتدوين ما قُرئ في كل ركعة (أو ما قرأ الإمام) • تنويع أذكار الركوع والسجود بين الركعات • الدعاء في كل سجدة",
  "متعة الجوال ممنوعة",
  "الصلاة على النبي في الفراغ",
  "تحدث الإنجليزية أو سماع بودكاست في السيارة",
  "متابعة الأخبار في الخلاء",
]

// رجل نشيط: عمل طويل، نوم قليل، ٣ أيام تمرين ← صيانة ≈ ٣٤ سعرة/كجم
function nutritionTargets(w: number) {
  const kcal = Math.round(w * 34)
  const protein = Math.round(w * 2)
  const fat = Math.round(w * 0.9)
  const carbs = Math.round((kcal - protein * 4 - fat * 9) / 4)
  return { kcal, protein, fat, carbs }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
      <Separator className="mt-1" />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="text-muted-foreground text-xs">{value}</span>
    </div>
  )
}

// عدّاد لمسي: زيادة/نقصان بمقدار جاهز — بلا كتابة
function FoodStepper({
  label,
  value,
  target,
  unit,
  step,
  onDelta,
}: {
  label: string
  value: number
  target: number
  unit: string
  step: number
  onDelta: (d: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-1 text-sm">
      <span className="flex-none">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs tabular-nums"
          aria-label={`إنقاص ${label}`}
          onClick={() => onDelta(-step)}
        >
          −{arab(step)}
        </Button>
        <span className="text-muted-foreground w-24 text-center text-xs tabular-nums">
          {arab(value)} / {arab(target)} {unit}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs tabular-nums"
          aria-label={`زيادة ${label}`}
          onClick={() => onDelta(step)}
        >
          +{arab(step)}
        </Button>
      </div>
    </div>
  )
}

export function DayPanel({
  open,
  onClose,
  events,
}: {
  open: boolean
  onClose: () => void
  events: Ev[]
}) {
  const [openPool, setOpenPool] = useState<string | null>(null)
  const d = currentUnit() // وحدة اليوم تبدأ بنومة الثلث الأخير
  const dayEvents = events.filter((e) => e.unit === d)
  const donePools = completedQuranPools(events, d) // ما أنجزته اليوم من مواضع القرآن

  // إنجاز اليوم
  // البلوكات التي لها بنود فعلًا (أو عُلّمت منجزة) — النوم والراحة الفارغة لا تُحتسب
  const actionable = dayEvents.filter((e) => checkable(e).length > 0 || e.done)
  // البند المؤدَّى قضاءً يُحتسب نصف إنجاز
  let score = 0
  let lateTotal = 0
  for (const e of actionable) {
    const items = checkable(e)
    if (items.length) {
      const marked = new Set(checksFor(e.id))
      let s = 0
      for (const l of items) {
        if (!marked.has(l.id)) continue
        if (isLate(e.id, l.id)) {
          s += settings.qada.credit // حظّ المقضيّ — يضبطه المستخدم
          lateTotal++
        } else s += 1
      }
      score += s / items.length
    } else if (e.done) score += 1
  }
  const pct = actionable.length ? Math.round((score / actionable.length) * 100) : 0

  // القرآن
  const st = quranStateFor(d < SCHEDULE_START ? SCHEDULE_START : d)
  // تقدّمُ الحزب: أربعةُ أرباع، ويومُ القراءة نصفُ خطوة
  const hifzPct = Math.round(((st.hifzQuarter - 1 + (st.hifzMode === "قراءة" ? 0.5 : 0)) / 4) * 100)

  // القوة
  const snap = strengthSnapshot(d < SCHEDULE_START ? SCHEDULE_START : d) as {
    name: string
    reps?: number
    weight?: number
    seconds?: number
  }[]

  // الساعات: تُجمَع من بلوكات اليوم نفسِه بأسمائها — فمن غيّر قالبه تغيّرت
  // معه القائمة بلا تعديل سطر. والصلواتُ صفٌّ واحد، والنومُ صفٌّ واحد.
  const PRAYER_SLOTS = ["fajr", "dhuhr", "asr", "maghrib", "isha"]
  const hourRows = (() => {
    const byLabel = new Map<string, number>()
    const add = (label: string, min: number) => byLabel.set(label, (byLabel.get(label) || 0) + min)
    for (const e of dayEvents) {
      if (e.external) continue
      const slot = e.slot || ""
      const min = durMin(e)
      if (min <= 0) continue
      if (PRAYER_SLOTS.includes(slot)) add("صلوات", min)
      else if (slot.startsWith("sleep") || slot === "nap") add("نوم", min)
      else add(e.title, min)
    }
    return [...byLabel.entries()].sort((a, b) => b[1] - a[1])
  })()

  // التغذية: وجبات اليوم كما هي في بلوكاته — وفي أيام الصيام تسقط وجبةُ نهاره
  const meals = dayEvents
    .filter((e) => !e.external)
    .flatMap((e) => e.items.filter((i) => /وجبة/.test(i.text)).map((i) => `${i.text} — ${e.title}`))
  const w = settings.weight || 70
  const tgt = nutritionTargets(w)
  const eaten = foodFor(d)

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[320px] overflow-y-auto sm:w-[360px]">
        <SheetHeader>
          <SheetTitle>لوحة يوم {fmtDateLong(d)}</SheetTitle>
          <p className="text-muted-foreground text-xs">اليوم يبدأ بنومة الثلث الأخير وينتهي بنهاية قيام ليلته</p>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-8">
          <Section title={`إنجاز اليوم ${arab(pct)}٪`}>
            <Progress value={pct} className="h-2" />
            <Row
              label="أحداث مكتملة ✅"
              value={`${arab(actionable.filter((e) => e.done).length)} من ${arab(actionable.length)}`}
            />
            {lateTotal > 0 && (
              <Row label="بنود أُدّيت قضاءً ½" value={`${arab(lateTotal)} — نصف إنجاز`} />
            )}
          </Section>

          <Section title="القرآن">
            <Row
              label="المراجعة (في الوتر)"
              value={
                reviewHizbs(st).length
                  ? `الأحزاب ${reviewHizbs(st).map(arab).join("، ")} — دورة ١–${arab(reviewMax(st))}`
                  : "لم تبدأ بعد"
              }
            />
            <Row label="الحفظ" value={`${st.hifzMode} الربع ${arab(st.hifzQuarter)} من الحزب ${arab(st.hifzHizb)}`} />
            <Row
              label="التثبيت (في السنن)"
              value={`الأحزاب ${arab(tathbeetWindow(st).from)}–${arab(tathbeetWindow(st).to)}`}
            />
            <Progress value={hifzPct} className="h-1.5" />
            <Row label="تقدّم حزب الحفظ" value={`${arab(hifzPct)}٪`} />
          </Section>

          {/* الأخطاء: تظهر مواضع اليوم التي أنجزتها فقط — اضغط الموضع لتسجيل أخطائه */}
          <Section title="أخطاء القرآن">
            {donePools.length === 0 ? (
              <p className="text-muted-foreground text-xs leading-relaxed">
                أشّر ما أنجزته من التسميع والتكرار والسنن، ويظهر هنا لتسجيل أخطائه.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {donePools.map((p) => {
                  const list = mistakesFor(p.pool)
                  const isOpen = openPool === p.pool
                  return (
                    <div key={p.pool} className="flex flex-col">
                      <button
                        onClick={() => setOpenPool(isOpen ? null : p.pool)}
                        className="hover:bg-muted flex items-start gap-2 rounded-md p-2 text-start text-sm"
                      >
                        <ChevronDownIcon
                          className={cn("mt-0.5 size-4 flex-none transition-transform", !isOpen && "-rotate-90")}
                        />
                        <span className="flex-1 leading-relaxed">
                          {p.text}
                          <span className="text-muted-foreground/70 text-xs"> ({p.from})</span>
                        </span>
                        {list.length > 0 && (
                          <span className="flex-none rounded bg-red-500/15 px-1.5 text-xs text-red-600 dark:text-red-400">
                            {arab(list.length)}
                          </span>
                        )}
                      </button>
                      {isOpen && <MistakeTracker poolKey={p.pool} />}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          <Section title="قوتك الآن">
            {snap.map((s) => (
              <Row
                key={s.name}
                label={s.name}
                value={s.seconds != null ? `${arab(s.seconds)} ث` : `${arab(s.weight!)} كجم × ${arab(s.reps!)}`}
              />
            ))}
          </Section>

          <Section title="ساعات اليوم">
            {hourRows.map(([label, min]) => (
              <Row key={label} label={label} value={fmtDur(min)} />
            ))}
          </Section>

          <Section title="التغذية">
            <div className="flex items-center justify-between text-sm">
              <span>الوزن</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="إنقاص الوزن"
                  onClick={() => saveSettings({ weight: Math.max(30, w - 1) })}
                >
                  <MinusIcon />
                </Button>
                <span className="w-16 text-center text-sm tabular-nums">{arab(w)} كجم</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="زيادة الوزن"
                  onClick={() => saveSettings({ weight: Math.min(200, w + 1) })}
                >
                  <PlusIcon />
                </Button>
              </div>
            </div>
            <Row label="هدفك اليومي" value={`${arab(tgt.kcal)} سعرة • ب ${arab(tgt.protein)} • ك ${arab(tgt.carbs)} • د ${arab(tgt.fat)} غ`} />
            <Row
              label={`وجبات اليوم: ${arab(meals.length)}`}
              value={meals.join(" • ")}
            />
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              سجّل سعرات كل وجبة وماكروزها هنا — يجب بلوغ الهدف ولو بوجبتين.
            </p>
            <FoodStepper label="سعرات" value={eaten.kcal} target={tgt.kcal} unit="" step={100} onDelta={(x) => addFood(d, { kcal: x })} />
            <Progress value={Math.min(100, (eaten.kcal / tgt.kcal) * 100)} className="h-1.5" />
            <FoodStepper label="بروتين" value={eaten.p} target={tgt.protein} unit="غ" step={10} onDelta={(x) => addFood(d, { p: x })} />
            <Progress value={Math.min(100, (eaten.p / tgt.protein) * 100)} className="h-1.5" />
            <FoodStepper label="كارب" value={eaten.c} target={tgt.carbs} unit="غ" step={10} onDelta={(x) => addFood(d, { c: x })} />
            <FoodStepper label="دهون" value={eaten.f} target={tgt.fat} unit="غ" step={5} onDelta={(x) => addFood(d, { f: x })} />
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground self-start"
              onClick={() => resetFood(d)}
            >
              <RotateCcwIcon />
              تصفير اليوم
            </Button>
          </Section>

          <Card className="bg-muted/40 py-3">
            <CardContent className="flex flex-col gap-2 px-4">
              <h3 className="text-sm font-semibold">ملاحظات ملزمة</h3>
              {BINDING_NOTES.map((n) => (
                <p key={n} className="text-muted-foreground text-xs leading-relaxed">
                  • {n}
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  )
}
