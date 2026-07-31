"use client"

import { MinusIcon, PlusIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { arab } from "@/lib/engine/dates.js"
import { quranStateFor } from "@/lib/engine/quran.js"
import { strengthSnapshot } from "@/lib/engine/workout.js"
import { checklistLines, durMin, fmtDateLong, fmtDur, dow } from "@/lib/format"
import {
  addFood,
  checksFor,
  currentUnit,
  foodFor,
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
  const d = currentUnit() // وحدة اليوم تبدأ بصلاة الفجر
  const dayEvents = events.filter((e) => e.unit === d)

  // إنجاز اليوم
  const actionable = dayEvents.filter(
    (e) => !["sleep1", "sleep2", "nap", "rest"].includes(e.slot || "")
  )
  let score = 0
  for (const e of actionable) {
    if (e.done) {
      score += 1
      continue
    }
    const items = checklistLines(e.desc).filter((l) => l.item)
    if (items.length) {
      const marked = new Set(checksFor(e.id))
      score += items.filter((l) => marked.has(l.idx)).length / items.length
    }
  }
  const pct = actionable.length ? Math.round((score / actionable.length) * 100) : 0

  // القرآن
  const st = quranStateFor(d < SCHEDULE_START ? SCHEDULE_START : d)
  const hifzPct = Math.round(((st.hifzQuarter - 1 + (st.hifzMode === "تكرار" ? 0.5 : 0)) / 8) * 100)

  // القوة
  const snap = strengthSnapshot(d < SCHEDULE_START ? SCHEDULE_START : d) as {
    name: string
    reps?: number
    weight?: number
    seconds?: number
  }[]

  // الساعات
  const sum = (slots: string[]) =>
    dayEvents.filter((e) => slots.includes(e.slot || "")).reduce((a, e) => a + durMin(e), 0)

  // التغذية
  const w = settings.weight || 70
  const tgt = nutritionTargets(w)
  const eaten = foodFor(d)

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[320px] overflow-y-auto sm:w-[360px]">
        <SheetHeader>
          <SheetTitle>لوحة يوم {fmtDateLong(d)}</SheetTitle>
          <p className="text-muted-foreground text-xs">اليوم يبدأ بصلاة الفجر وينتهي بفجر الغد</p>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-8">
          <Section title={`إنجاز اليوم ${arab(pct)}٪`}>
            <Progress value={pct} className="h-2" />
            <Row
              label="أحداث مكتملة ✅"
              value={`${arab(actionable.filter((e) => e.done).length)} من ${arab(actionable.length)}`}
            />
          </Section>

          <Section title="القرآن">
            <Row label="التسميع" value={`الجزء ${arab(st.reviewJuz)} (دورة ١–${arab(st.hifzJuz - 3)})`} />
            <Row label="الحفظ" value={`${st.hifzMode} الربع ${arab(st.hifzQuarter)} من الجزء ${arab(st.hifzJuz)}`} />
            <Row label="التثبيت" value={`الجزءان ${arab(st.hifzJuz - 2)} و${arab(st.hifzJuz - 1)}`} />
            <Progress value={hifzPct} className="h-1.5" />
            <Row label="تقدّم جزء الحفظ" value={`${arab(hifzPct)}٪`} />
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
            <Row label={dow(d) === 5 ? "عائلة" : "عمل"} value={fmtDur(sum(["work1", "work2", "work3"]))} />
            <Row label="نوم" value={fmtDur(sum(["sleep1", "sleep2", "nap"]))} />
            <Row label={dow(d) === 5 || dow(d) === 6 ? "راحة" : "زوجة"} value={fmtDur(sum(["rest"]))} />
            <Row label="أسرة" value={fmtDur(sum(["family"]))} />
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
