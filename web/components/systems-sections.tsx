"use client"

import { useState } from "react"
import { CheckIcon, ChevronDownIcon, MapPinIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Help } from "@/components/help"
import { arab } from "@/lib/format"
import { saveSettings, settings, wirdCandidates } from "@/lib/store"

// قسمٌ مطوي: الإعداد الذي لا يحتاجه أكثر الناس لا يزاحمهم في الشاشة
export function Section({
  title,
  help,
  children,
  defaultOpen = false,
}: {
  title: string
  help?: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t pt-3">
      <div className="flex w-full items-center gap-1">
        <button onClick={() => setOpen((v) => !v)} className="flex flex-1 items-center gap-1 text-start">
          <ChevronDownIcon className={cn("size-4 flex-none transition-transform", !open && "-rotate-90")} />
          <h3 className="text-sm font-semibold">{title}</h3>
        </button>
        {help && <Help text={help} />}
      </div>
      {open && <div className="flex flex-col gap-2 pt-2">{children}</div>}
    </div>
  )
}

function Num({
  label,
  value,
  onChange,
  min = 1,
  max = 999,
  suffix,
  help,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  suffix?: string
  help?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-muted-foreground min-w-24 flex-none text-xs">{label}</label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, +e.target.value || min)))}
        className="h-8 w-20"
      />
      {suffix && <span className="text-muted-foreground text-[11px]">{suffix}</span>}
      {help && <Help text={help} />}
    </div>
  )
}

function Pick({
  options,
  value,
  onChange,
}: {
  options: [string, string][]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={cn(
            "rounded-md border px-2 py-0.5 text-xs transition-colors",
            value === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── القرآن: النمط، وموضع البدء، ومرات التكرار ─────────────────────
export function QuranSection() {
  const q = settings.quran
  const set = (patch: Partial<typeof q>) => saveSettings({ quran: { ...q, ...patch } })
  return (
    <Section
      title="القرآن: الحفظ والمراجعة"
      help="نظامان: مُدارٌ يعرف موضعك ويتقدّم بك وحده كل يوم، وحرٌّ يضع لك بندين تكتب فيهما ما قرأت بلا مطالبة بموضع."
    >
      <Pick
        options={[
          ["managed", "مُدار"],
          ["free", "حرّ"],
        ]}
        value={q.mode}
        onChange={(mode) => set({ mode })}
      />
      {q.mode === "managed" ? (
        <>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            من أين تبدأ؟ البرنامج يمضي من هذا الموضع فصاعدًا، ويتقدّم كلما أنجزت.
          </p>
          <Num
            label="جزء الحفظ"
            value={q.hifzJuz}
            min={4}
            max={30}
            onChange={(hifzJuz) => set({ hifzJuz })}
            help="لا ينزل عن ٤، لأن التثبيت يقرأ الجزأين اللذين قبله والتسميع يدور فيما قبلهما."
          />
          <Num
            label="الربع داخل الجزء"
            value={q.hifzQuarter}
            min={1}
            max={8}
            onChange={(hifzQuarter) => set({ hifzQuarter })}
          />
          <Pick
            options={[
              ["حفظ", "اليوم حفظ"],
              ["تكرار", "اليوم تكرار"],
            ]}
            value={q.hifzMode}
            onChange={(hifzMode) => set({ hifzMode })}
          />
          <Num
            label="جزء التسميع"
            value={q.reviewJuz}
            min={1}
            max={30}
            onChange={(reviewJuz) => set({ reviewJuz })}
          />
          <Num
            label="مرات التكرار"
            value={q.repeats}
            min={1}
            max={20}
            suffix="مرة"
            onChange={(repeats) => set({ repeats })}
            help="في يوم التكرار يُعاد ربعُ الحفظ هذا العدد من المرات."
          />
        </>
      ) : (
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          بندان في بلوك المهام: «تسميع المراجعة» و«الحفظ» — تؤشّرهما بما قرأت، بلا موضع يُفرض عليك.
        </p>
      )}
      <p className="text-muted-foreground pt-1 text-[11px] leading-relaxed">
        تغييرُ الموضع يعيد حساب أيامك من يوم البذرة فصاعدًا — فما أنجزتَه محفوظ، وإنما يتبدّل ما يُطلب منك.
      </p>
    </Section>
  )
}

// ── الورد في السنن ────────────────────────────────────────────────
export function WirdSection() {
  const cands = wirdCandidates()
  const on = (slot: string, id: string) => settings.wird.some((w) => w[0] === slot && w[1] === id)
  const toggle = (slot: string, id: string) => {
    const next = on(slot, id)
      ? settings.wird.filter((w) => !(w[0] === slot && w[1] === id))
      : // يُدرَج في موضعه الزمني لا في آخر القائمة، فيبقى الورد على ترتيب اليوم
        [...settings.wird, [slot, id] as [string, string]].sort(
          (a, b) =>
            cands.findIndex((c) => c.slot === a[0] && c.id === a[1]) -
            cands.findIndex((c) => c.slot === b[0] && c.id === b[1])
        )
    if (next.length) saveSettings({ wird: next })
  }
  return (
    <Section
      title="الورد في السنن"
      help="ورد التثبيت يُقسَّم على السنن التي تختارها بترتيبها في يومك: كل سنّة نصيبها. وما فاتك منها لا يُتخطّى — تبدأ السنّة التالية من حيث وقفت."
    >
      <p className="text-muted-foreground text-[11px] leading-relaxed">
        اختر السنن التي تقرأ فيها وردك ({arab(settings.wird.length)} مختارة).
      </p>
      {cands.map((c) => (
        <button key={`${c.slot}:${c.id}`} onClick={() => toggle(c.slot, c.id)} className="flex items-center gap-2 text-start">
          <span
            className={cn(
              "flex size-4 flex-none items-center justify-center rounded border",
              on(c.slot, c.id) ? "bg-primary border-primary text-primary-foreground" : "border-border"
            )}
          >
            {on(c.slot, c.id) && <CheckIcon className="size-3" />}
          </span>
          <span className="text-xs">{c.title}</span>
        </button>
      ))}
    </Section>
  )
}

// ── التمرين ───────────────────────────────────────────────────────
export function WorkoutSection() {
  const w = settings.workout
  const [openEx, setOpenEx] = useState<string | null>(null)
  const set = (patch: Partial<typeof w>) => saveSettings({ workout: { ...w, ...patch } })
  const setEx = (key: string, patch: Record<string, unknown>) =>
    set({ exercises: { ...w.exercises, [key]: { ...w.exercises[key], ...patch } } })

  return (
    <Section
      title="التمرين"
      help="دورة متتابعة لا علاقة لها بأيام الأسبوع. والتقدّم مزدوج: تزيد العدّات كل جلسة حتى أعلى النطاق، ثم تزيد الوزن وترجع إلى أدناه."
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-muted-foreground min-w-24 flex-none text-xs">اسم يوم الراحة</label>
        <Input value={w.offTitle} onChange={(e) => set({ offTitle: e.target.value })} className="h-8 w-28" />
      </div>

      <button onClick={() => set({ restBetween: !w.restBetween })} className="flex items-start gap-2 text-start">
        <span
          className={cn(
            "mt-0.5 flex size-4 flex-none items-center justify-center rounded border",
            w.restBetween ? "bg-primary border-primary text-primary-foreground" : "border-border"
          )}
        >
          {w.restBetween && <CheckIcon className="size-3" />}
        </span>
        <span className="flex-1">
          <span className="text-xs">يوم راحة بين كل تمرينين</span>
          <span className="text-muted-foreground block text-[11px] leading-relaxed">
            أطفئه لتتمرّن يومًا بعد يوم بلا فاصل — فتصير الدورة {arab(w.days.length)} أيام متتابعة.
          </span>
        </span>
      </button>

      <div className="text-muted-foreground pt-1 text-[11px]">التمارين وأوزانها</div>
      {Object.entries(w.exercises).map(([key, ex]) => (
        <div key={key} className="rounded-md border p-2">
          <button
            onClick={() => setOpenEx(openEx === key ? null : key)}
            className="flex w-full items-center gap-2 text-start"
          >
            <ChevronDownIcon className={cn("size-4 flex-none transition-transform", openEx !== key && "-rotate-90")} />
            <span className="flex-1 text-xs">{ex.name}</span>
            <span className="text-muted-foreground text-[11px]">
              {arab(ex.sets)}×{arab(ex.lo)}–{arab(ex.hi)}
              {ex.w0 != null && ` · ${arab(ex.w0)} كجم`}
            </span>
          </button>
          {openEx === key && (
            <div className="flex flex-col gap-1.5 pt-2">
              <div className="flex items-center gap-2">
                <label className="text-muted-foreground min-w-16 flex-none text-xs">الاسم</label>
                <Input value={ex.name} onChange={(e) => setEx(key, { name: e.target.value })} className="h-8" />
              </div>
              <Num label="المجموعات" value={ex.sets} min={1} max={10} onChange={(v) => setEx(key, { sets: v })} />
              <Num label="أدنى العدّات" value={ex.lo} min={1} max={50} onChange={(v) => setEx(key, { lo: v })} />
              <Num label="أعلى العدّات" value={ex.hi} min={1} max={50} onChange={(v) => setEx(key, { hi: v })} />
              <Num
                label="وزن البداية"
                value={ex.w0 ?? 0}
                min={0}
                max={500}
                suffix="كجم"
                onChange={(v) => setEx(key, { w0: v })}
                help="صفر يعني بوزن جسمك أو بلا أثقال. وهذا هو موضع تحديد الوزن لما كان يقول «حدّد الوزن»."
              />
              <Num
                label="الزيادة"
                value={ex.inc}
                min={0}
                max={50}
                suffix="كجم"
                onChange={(v) => setEx(key, { inc: v })}
                help="كم يزيد الوزن متى بلغتَ أعلى النطاق في كل المجموعات."
              />
              <Num label="الراحة" value={ex.rest} min={0} max={600} suffix="ثانية" onChange={(v) => setEx(key, { rest: v })} />
            </div>
          )}
        </div>
      ))}

      <div className="text-muted-foreground pt-1 text-[11px]">أيام الدورة</div>
      {w.days.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={d.title}
            onChange={(e) => {
              const days = w.days.map((x, k) => (k === i ? { ...x, title: e.target.value } : x))
              set({ days })
            }}
            className="h-8"
          />
          {w.days.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="حذف اليوم"
              className="text-destructive size-8"
              onClick={() => set({ days: w.days.filter((_, k) => k !== i) })}
            >
              <Trash2Icon />
            </Button>
          )}
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() =>
          set({
            days: [
              ...w.days,
              { title: `تمرين — يوم ${arab(w.days.length + 1)}`, header: w.days[0]?.header || "", items: [] },
            ],
          })
        }
      >
        <PlusIcon />
        يوم تمرين
      </Button>
      <p className="text-muted-foreground text-[11px] leading-relaxed">
        اليوم الجديد يبدأ فارغًا؛ ولإضافة تمارينه اجعله يشبه يومًا قائمًا ثم عدّل. وحذف يومٍ يقصّر الدورة.
      </p>
    </Section>
  )
}

// ── الموقع والمواقيت ──────────────────────────────────────────────
const METHODS: [string, string][] = [
  ["ummAlQura", "أم القرى"],
  ["mwl", "رابطة العالم الإسلامي"],
  ["isna", "ISNA"],
  ["egypt", "المصرية"],
  ["karachi", "كراتشي"],
  ["dubai", "دبي"],
]

export function LocationSection() {
  const [msg, setMsg] = useState("")
  return (
    <Section
      title="الموقع والمواقيت"
      help="جدولك كله مبنيّ على مواقيت مكانك، فإن انتقلت أو سافرت غيّرها هنا فيتحرك الجدول معك."
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-muted-foreground flex-none text-xs">خط العرض</label>
        <Input
          type="number"
          step="0.0001"
          value={settings.lat}
          onChange={(e) => saveSettings({ lat: +e.target.value })}
          className="h-8 w-28"
        />
        <label className="text-muted-foreground flex-none text-xs">الطول</label>
        <Input
          type="number"
          step="0.0001"
          value={settings.lng}
          onChange={(e) => saveSettings({ lng: +e.target.value })}
          className="h-8 w-28"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-muted-foreground flex-none text-xs">فرق التوقيت</label>
        <Input
          type="number"
          step="0.5"
          value={settings.tz}
          onChange={(e) => saveSettings({ tz: +e.target.value })}
          className="h-8 w-20"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (!navigator.geolocation) return setMsg("متصفحك لا يدعم تحديد الموقع")
            setMsg("جارٍ تحديد موقعك…")
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                saveSettings({
                  lat: +pos.coords.latitude.toFixed(4),
                  lng: +pos.coords.longitude.toFixed(4),
                  tz: -new Date().getTimezoneOffset() / 60,
                })
                setMsg("✅ حُدّد موقعك")
              },
              () => setMsg("تعذّر تحديد موقعك")
            )
          }}
        >
          <MapPinIcon />
          موقعي
        </Button>
      </div>
      {msg && <p className="text-muted-foreground text-[11px]">{msg}</p>}

      <div className="text-muted-foreground pt-1 text-[11px]">طريقة الحساب</div>
      <Pick options={METHODS} value={settings.method} onChange={(method) => saveSettings({ method })} />

      <div className="flex items-center gap-1 pt-1">
        <span className="text-muted-foreground text-[11px]">مذهب العصر</span>
        <Help text="الجمهور: يدخل العصر إذا صار ظلّ الشيء مثلَه. والحنفية: إذا صار مثلَيه — فيتأخر العصر، ويتأخر معه ما بعده من بلوكاتك." />
      </div>
      <Pick
        options={[
          ["1", "الجمهور (مثله)"],
          ["2", "الحنفية (مثليه)"],
        ]}
        value={String(settings.asrFactor)}
        onChange={(v) => saveSettings({ asrFactor: +v })}
      />
    </Section>
  )
}
