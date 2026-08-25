"use client"

import { useState } from "react"
import { CheckIcon, ChevronDownIcon, MapPinIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Help } from "@/components/help"
import { arab } from "@/lib/format"
import { bodyLog, logBody, saveSettings, settings, wirdCandidates } from "@/lib/store"

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
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => set({ components: { ...(q.components ?? { review: true, hifz: true }), hifz: !(q.components?.hifz ?? true) } })}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs",
                (q.components?.hifz ?? true) ? "border-primary bg-primary text-primary-foreground" : "border-border"
              )}
            >
              حفظ
            </button>
            <button
              onClick={() => set({ components: { ...(q.components ?? { review: true, hifz: true }), review: !(q.components?.review ?? true) } })}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs",
                (q.components?.review ?? true) ? "border-primary bg-primary text-primary-foreground" : "border-border"
              )}
            >
              تسميع
            </button>
            <Help text="ركّب نظامك: حفظٌ وحده، أو تسميعٌ وحده، أو كلاهما — كلٌّ بمفتاحه." />
          </div>
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
      <Pick
        options={[
          ["reading", "قراءة بمقدار"],
          ["tathbeet", "مربوط بالحفظ (تثبيت)"],
        ]}
        value={settings.quran.wirdMode ?? "tathbeet"}
        onChange={(wirdMode) => saveSettings({ quran: { ...settings.quran, wirdMode: wirdMode as "reading" | "tathbeet" } })}
      />
      {(settings.quran.wirdMode ?? "tathbeet") === "reading" && (
        <div className="flex items-center gap-2">
          <label className="text-muted-foreground flex-none text-xs">المقدار</label>
          <Input
            defaultValue={settings.quran.wirdAmount ?? "ربع حزب"}
            onBlur={(e) => saveSettings({ quran: { ...settings.quran, wirdAmount: e.target.value.trim() || "ربع حزب" } })}
            className="h-8 w-32"
          />
        </div>
      )}
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

      <div className="text-muted-foreground pt-1 text-[11px]">متى تتمرّن؟</div>
      <Pick
        options={[
          ["cycle", "دورة لا تعرف الأسبوع"],
          ["weekly", "أيام محددة من الأسبوع"],
        ]}
        value={w.scheduleMode ?? "cycle"}
        onChange={(m) => set({ scheduleMode: m as "cycle" | "weekly" })}
      />
      {(w.scheduleMode ?? "cycle") === "weekly" && (
        <div className="flex flex-wrap gap-1">
          {["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"].map((name, i) => (
            <button
              key={i}
              onClick={() => {
                const days = w.weeklyDays ?? []
                set({ weeklyDays: days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort() })
              }}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs",
                (w.weeklyDays ?? []).includes(i) ? "border-primary bg-primary text-primary-foreground" : "border-border"
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {(w.scheduleMode ?? "cycle") === "cycle" && (
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
      )}
      <p className="text-muted-foreground text-[11px] leading-relaxed">
        «أيام التمرين» أدناه نسخٌ تتناوب على مواعيدك موعدًا بعد موعد — نسخة أ ثم ب ثم أ. اجعلها
        نسخةً واحدة إن كان تمرينك واحدًا.
      </p>

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

// ── الجسد والغذاء ─────────────────────────────────────────────────
export function BodySection() {
  const nu = settings.nutrition
  const [w, setW] = useState(settings.weight)
  const [h, setH] = useState(nu.height)
  const [saved, setSaved] = useState(false)
  const log = bodyLog()
  const kcal = Math.round(w * nu.kcalPerKg)
  const protein = Math.round(w * nu.proteinPerKg)
  return (
    <Section
      title="الجسد والغذاء"
      help="من وزنك وطولك تُحسب سعراتك وبروتينك. سجّلهما كل شهر — فالرقم الذي لا يُقاس لا يتحسّن."
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-muted-foreground flex-none text-xs">الوزن</label>
        <Input type="number" min={30} max={250} value={w} onChange={(e) => setW(+e.target.value || w)} className="h-8 w-20" />
        <span className="text-muted-foreground text-[11px]">كجم</span>
        <label className="text-muted-foreground flex-none text-xs">الطول</label>
        <Input type="number" min={100} max={230} value={h} onChange={(e) => setH(+e.target.value || h)} className="h-8 w-20" />
        <span className="text-muted-foreground text-[11px]">سم</span>
        <Button
          size="sm"
          onClick={() => {
            logBody(w, h)
            setSaved(true)
          }}
        >
          سجّل
        </Button>
      </div>
      {saved && <p className="text-muted-foreground text-[11px]">سُجّل بتاريخ اليوم ✅</p>}
      <p className="text-muted-foreground text-[11px] leading-relaxed">
        هدفك اليومي: {arab(kcal)} سعرة · {arab(protein)} غ بروتين — وتسجّل وجباتك من «لوحة اليوم».
      </p>
      {log.length > 1 && (
        <div className="text-muted-foreground text-[11px] leading-relaxed">
          سجلّك:{" "}
          {log
            .slice(-6)
            .map((e) => `${e.date.slice(5)}: ${arab(e.weight)} كجم`)
            .join(" · ")}
        </div>
      )}
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
