"use client"

// المعالج الأول — رحلةُ كلِّ مستخدمٍ جديد:
// الموقع، فمدد الصلاة، فقواعدُ الفهم، فالنوم بدوراته الكاملة ونمطِ النبي ﷺ
// الموصى به، فالقيام في أسداس الليل، فالصيام والطعام، فالتمرين، فالقرآن،
// فبداية اليوم، فالخزائن — ثم تقويمٌ يبنيه صاحبُه بيده.
//
// كل شيء محليٌّ في جهازك بلا حساب: الحساب اختيارٌ لاحق من الإعدادات لمن أراد
// المزامنة بين أجهزته — وربطُ تقويم Google محليٌّ كذلك (قراءةً فقط من متصفحك).
//
// كل الاختيارات تُركَّب قالبًا واحدًا عبر composeDayTemplate (دالة محضة مفحوصة)
// عند «ابدأ» — فالمعالج واجهةٌ فقط ولا منطقَ زمنيًّا فيه.
import { useEffect, useMemo, useState } from "react"
import { CheckIcon, MapPinIcon, PlusIcon, RotateCcwIcon, Trash2Icon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Help } from "@/components/help"
import { arab } from "@/lib/format"
// المركّب دالة JS محضة — توقيعها هنا ليطمئن المدقق
import { composeDayTemplate as composeRaw } from "@/lib/engine/compose.js"
const composeDayTemplate = composeRaw as (o: {
  prayerMinutes?: Record<string, number>
  sleep?: { start: "afterIsha" | number; hoursMin?: number; hoursMax?: number; qaylulah?: boolean; cycle?: number }
  qiyam?: { sixth: number; minutes: number | null } | null
  meals?: { name: string; prayer: string; fastingSkip?: boolean }[]
}) => Template
import { startCandidates } from "@/lib/engine/layout.js"
import {
  ensureRoutineCabinet,
  loadHaithamPreset,
  prayerTasksOf,
  previewCompose,
  resetPrayerTasks,
  setPrayerTasks,
  saveSettings,
  settings,
  todayIso,
  wirdCandidates,
  type Template,
} from "@/lib/store"
import { DEFAULT_QURAN } from "@/lib/engine/quran.js"

const CITIES = [
  { name: "الرياض", lat: 24.7136, lng: 46.6753, tz: 3, method: "ummAlQura" },
  { name: "مكة المكرمة", lat: 21.3891, lng: 39.8579, tz: 3, method: "ummAlQura" },
  { name: "المدينة المنورة", lat: 24.5247, lng: 39.5692, tz: 3, method: "ummAlQura" },
  { name: "جدة", lat: 21.4858, lng: 39.1925, tz: 3, method: "ummAlQura" },
  { name: "الدمام", lat: 26.4207, lng: 50.0888, tz: 3, method: "ummAlQura" },
  { name: "القاهرة", lat: 30.0444, lng: 31.2357, tz: 2, method: "egypt" },
  { name: "دبي", lat: 25.2048, lng: 55.2708, tz: 4, method: "dubai" },
  { name: "الدوحة", lat: 25.2854, lng: 51.531, tz: 3, method: "ummAlQura" },
  { name: "الكويت", lat: 29.3759, lng: 47.9774, tz: 3, method: "ummAlQura" },
  { name: "عمّان", lat: 31.9454, lng: 35.9284, tz: 3, method: "mwl" },
  { name: "إسطنبول", lat: 41.0082, lng: 28.9784, tz: 3, method: "mwl" },
  { name: "لندن", lat: 51.5072, lng: -0.1276, tz: 0, method: "mwl" },
]

const METHODS = [
  { key: "ummAlQura", name: "أم القرى" },
  { key: "mwl", name: "رابطة العالم الإسلامي" },
  { key: "isna", name: "ISNA" },
  { key: "egypt", name: "المصرية" },
  { key: "karachi", name: "كراتشي" },
  { key: "dubai", name: "دبي" },
]

const PRAYER_NAMES: [string, string][] = [
  ["fajr", "الفجر"],
  ["dhuhr", "الظهر"],
  ["asr", "العصر"],
  ["maghrib", "المغرب"],
  ["isha", "العشاء"],
]

const SIXTH_NAMES: Record<number, string> = {
  1: "السدس الأول من الليل",
  2: "ثلث الليل",
  3: "نصف الليل",
  4: "الثلث الأخير",
  5: "السدس الأخير",
}

const STEPS = [
  "أين أنت؟",
  "مدة الصلاة",
  "بنود الصلاة",
  "قواعد البرنامج",
  "نومك",
  "قيام الليل",
  "الصيام والطعام",
  "التمرين",
  "القرآن",
  "بداية يومك",
  "الخزائن",
]

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1.5 text-xs transition-colors",
        on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
      )}
    >
      {children}
    </button>
  )
}

function Tick({ on, label, sub, onClick }: { on: boolean; label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-start gap-2 rounded-md border p-2 text-start transition-colors",
        on ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 flex-none items-center justify-center rounded border",
          on ? "bg-primary border-primary text-primary-foreground" : "border-border"
        )}
      >
        {on && <CheckIcon className="size-3" />}
      </span>
      <span className="flex-1">
        <span className="text-sm font-medium">{label}</span>
        {sub && <span className="text-muted-foreground block text-[11px] leading-relaxed">{sub}</span>}
      </span>
    </button>
  )
}

type Meal = { name: string; prayer: string; fastingSkip?: boolean }

// بلوكات الصلاة ومولّداتها — تُقرأ منها البنود الافتراضية أول مرة
const PRAYER_GENS: [string, string, string][] = [
  ["fajr", "الفجر", "fajr"],
  ["dhuhr", "الظهر", "dhuhr"],
  ["asr", "العصر", "asr"],
  ["maghrib", "المغرب", "maghribWeekend"],
  ["isha", "العشاء", "isha"],
  ["qiyam", "قيام الليل", "qiyamWeekend"],
]

// محرِّر بنود صلاةٍ واحدة — تُفتح فتُرى بنودُها، تُحذف وتُضاف وتُعاد تسميتها
function PrayerTasksRow({ slot, name, gen }: { slot: string; name: string; gen: string }) {
  const [open, setOpen] = useState(false)
  const [add, setAdd] = useState("")
  const items = prayerTasksOf(slot, gen)
  const write = (next: { id: string; text: string }[]) => setPrayerTasks(slot, next)
  return (
    <div className="rounded-md border p-2">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-start">
        <span className="flex-1 text-sm font-medium">{name}</span>
        <span className="text-muted-foreground text-[11px]">{arab(items.length)} بند</span>
      </button>
      {open && (
        <div className="flex flex-col gap-1 pt-2">
          {items.map((it, i) => (
            <div key={it.id + it.text} className="flex items-center gap-1">
              <Input
                defaultValue={it.text}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== it.text) write(items.map((x, k) => (k === i ? { ...x, text: v } : x)))
                }}
                className="h-7 text-[11px]"
              />
              <button
                onClick={() => write(items.filter((_, k) => k !== i))}
                className="text-muted-foreground hover:text-destructive flex-none"
                aria-label="حذف البند"
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <Input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="بند جديد…" className="h-7 text-[11px]" />
            <Button
              size="icon"
              variant="outline"
              className="size-7"
              aria-label="أضف بندًا"
              onClick={() => {
                if (!add.trim()) return
                write([...items, { id: "u" + Math.random().toString(36).slice(2, 7), text: add.trim() }])
                setAdd("")
              }}
            >
              <PlusIcon />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 self-start text-[11px]"
            onClick={() => resetPrayerTasks(slot)}
          >
            <RotateCcwIcon />
            أرجِع الافتراضية
          </Button>
        </div>
      )}
    </div>
  )
}

// البلوكات المكشوفة بقدر أبعد خطوة بلغها المستخدم — فالتقويم فارغٌ أولًا،
// وتظهر الصلوات مع خطوتها، فالنوم، فالقيام، ثم اليوم كله
function slotsFor(reached: number): string[] | null {
  if (reached < 1) return [] // لم يختر موقعه بعد: تقويم فارغ
  const out = ["fajr", "dhuhr", "asr", "maghrib", "isha"]
  if (reached >= 5) out.push("sleep2", "nap", "sleepN")
  if (reached >= 6) out.push("qiyam")
  if (reached >= 7) return null // الصيام والطعام فما بعدها: اليوم كله
  return out
}

export function Onboarding() {
  const [step, setStep] = useState(0)
  // أبعد ما بلغ: ١ بمجرّد اختيار موقعه (فتظهر صلواتُه فورًا)، ثم بكل خطوة
  const [reached, setReached] = useState(0)
  const [open, setOpen] = useState(true)
  // الموقع
  const [city, setCity] = useState<string | null>(null)
  const [loc, setLoc] = useState({ lat: settings.lat, lng: settings.lng, tz: settings.tz })
  const [method, setMethod] = useState(settings.method)
  const [geoMsg, setGeoMsg] = useState("")
  // المدد
  const [minutes, setMinutes] = useState(45)
  const [perPrayer, setPerPrayer] = useState(false)
  const [mins, setMins] = useState<Record<string, number>>(() =>
    Object.fromEntries(PRAYER_NAMES.map(([k]) => [k, 45]))
  )
  // النوم
  const [hoursMin, setHoursMin] = useState(6)
  const [hoursMax, setHoursMax] = useState(7)
  const [sleepStart, setSleepStart] = useState<"afterIsha" | number>("afterIsha")
  const [qaylulah, setQaylulah] = useState(true)
  // القيام
  const [qiyamOn, setQiyamOn] = useState(true)
  const [qiyamSixth, setQiyamSixth] = useState(4)
  const [qiyamFull, setQiyamFull] = useState(true)
  const [qiyamMin, setQiyamMin] = useState(45)
  // الصيام والطعام
  const [fasting, setFasting] = useState(false)
  const [meals, setMeals] = useState<Meal[]>([
    { name: "الفطور", prayer: "fajr" },
    { name: "الغداء", prayer: "dhuhr", fastingSkip: true },
    { name: "العَشاء", prayer: "maghrib" },
  ])
  const [newMeal, setNewMeal] = useState("")
  const [weight, setWeight] = useState(settings.weight)
  const [height, setHeight] = useState(settings.nutrition.height)
  // التمرين
  const [workoutOn, setWorkoutOn] = useState(false)
  const [wMode, setWMode] = useState<"weekly" | "cycle">("cycle")
  const [wDays, setWDays] = useState<number[]>([0, 2, 4])
  const [wRest, setWRest] = useState(true)
  // القرآن
  const [hifzOn, setHifzOn] = useState(false)
  const [compReview, setCompReview] = useState(true)
  const [compHifz, setCompHifz] = useState(true)
  const [hifzJuz, setHifzJuz] = useState(4)
  const [wirdOn, setWirdOn] = useState(false)
  const [wirdMode, setWirdMode] = useState<"reading" | "tathbeet">("reading")
  const [wirdAmount, setWirdAmount] = useState("ربع حزب")
  // بداية اليوم
  // اليوم ٢٤ ساعة، وبدايتُه المعتادة الفجر — ولمن شاء غيرَه في خطوته
  const [dayStartId, setDayStartId] = useState<string | null>("fajr")

  // القالب المركّب من الاختيارات الحالية — يُعاد بناؤه حيًّا لخطوة البداية
  const composed = useMemo(
    () =>
      composeDayTemplate({
        prayerMinutes: perPrayer ? mins : { fajr: minutes, dhuhr: minutes, asr: minutes, maghrib: minutes, isha: minutes },
        sleep: { start: sleepStart, hoursMin, hoursMax, qaylulah, cycle: 90 },
        qiyam: qiyamOn ? { sixth: qiyamSixth, minutes: qiyamFull ? null : qiyamMin } : null,
        meals,
      }) as Template,
    [perPrayer, mins, minutes, sleepStart, hoursMin, hoursMax, qaylulah, qiyamOn, qiyamSixth, qiyamFull, qiyamMin, meals]
  )

  // التقويم يُبنى أمام عينيه وهو يختار: المحرك يُهيّأ بالاختيارات الحيّة بلا حفظ
  const onboarded = settings.onboarded
  useEffect(() => {
    if (onboarded) return
    previewCompose({
      template: composed,
      dayStart: dayStartId ? { blockId: dayStartId } : null,
      lat: loc.lat,
      lng: loc.lng,
      tz: loc.tz,
      method,
      visibleSlots: slotsFor(reached),
    })
    return () => previewCompose(null)
  }, [onboarded, composed, dayStartId, loc, method, reached])

  if (settings.onboarded) return null

  const finish = () => {
    const today = todayIso()
    saveSettings({
      ...loc,
      method,
      templates: { day: composed },
      weekPlan: ["day", "day", "day", "day", "day", "day", "day"],
      dayStart: dayStartId ? { blockId: dayStartId } : null,
      fasting,
      weight,
      nutrition: { ...settings.nutrition, height },
      startDate: today,
      wirdEnabled: wirdOn,
      hifzEnabled: hifzOn,
      workoutEnabled: workoutOn,
      quran: {
        ...DEFAULT_QURAN,
        date: today,
        hifzJuz,
        reviewJuz: 1,
        components: { review: compReview, hifz: compHifz },
        wirdMode,
        wirdAmount,
      },
      // خطة تمرين فارغة يبنيها بيده — لا خطةَ أحدٍ تُفرض عليه
      workout: {
        start: today,
        offTitle: "راحة",
        restBetween: wRest,
        scheduleMode: wMode,
        weeklyDays: wDays,
        exercises: {},
        days: [{ title: "تمرين — نسخة أ", header: "", items: [] }],
      },
      onboarded: true,
    })
    // الورد يُوزَّع على كل سنن اليوم المركّب — ويهذّبه صاحبه من الإعدادات
    if (wirdOn) {
      const cands = wirdCandidates()
      if (cands.length) saveSettings({ wird: cands.map((c) => [c.slot, c.id] as [string, string]) })
    }
    // خزانة «روتين» بأدراج الأنظمة — بابُها الظاهر
    ensureRoutineCabinet()
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) return setGeoMsg("متصفحك لا يدعم تحديد الموقع")
    setGeoMsg("جارٍ تحديد موقعك…")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({
          lat: +pos.coords.latitude.toFixed(4),
          lng: +pos.coords.longitude.toFixed(4),
          tz: -new Date().getTimezoneOffset() / 60,
        })
        setCity(null)
        setGeoMsg("✅ حُدّد موقعك")
        setReached((r) => Math.max(r, 1))
      },
      () => setGeoMsg("تعذّر تحديد موقعك — اختر مدينتك أو أدخل الإحداثيات")
    )
  }

  // نافذةٌ منبثقة بزرّ إغلاق — تُغلق فيُرى التقويم كاملًا، وتُفتح بزرّ عائم.
  // (كانت لوحةً جانبية تزاحم التقويم وتقصّ بطاقاته)
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-primary text-primary-foreground fixed bottom-4 end-4 z-40 rounded-full px-4 py-2 text-sm font-medium shadow-lg"
      >
        أكمل الإعداد — {STEPS[step]}
      </button>
    )

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-0 backdrop-blur-[1px] sm:items-center sm:p-4">
    <div className="bg-background relative flex max-h-[80dvh] w-full flex-col gap-3 overflow-y-auto rounded-t-2xl border p-4 shadow-2xl sm:max-w-md sm:rounded-xl">
      <button
        onClick={() => setOpen(false)}
        aria-label="إغلاق"
        className="text-muted-foreground hover:text-foreground absolute end-3 top-3"
      >
        <XIcon className="size-5" />
      </button>
      <div className="pe-6">
        <h2 className="text-lg font-semibold">{STEPS[step]}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
            {step === 0 && "جدولك يُبنى على مواقيت الصلاة، فيتحرك معها كل يوم — وكل شيء في جهازك، بلا حساب."}
            {step === 1 && "كم تحتاج من الوقت لصلاتك؟"}
            {step === 2 && "ما الذي تفعله في كل صلاة؟ هذه بنودُك تؤشّرها كل يوم."}
            {step === 3 && "دقيقتان تفهم بهما البرنامج كله."}
            {step === 4 && "نومُك يصنع يومك — فهو أول ما يُرسم."}
            {step === 5 && "الليل من المغرب إلى الفجر ستةُ أجزاء — ضع قيامك حيث شئت."}
            {step === 6 && "متى تأكل؟ وهل تصوم الاثنين والخميس؟"}
            {step === 7 && "أيام تمرينك وطريقتها — والتمارين نفسها تبنيها من الإعدادات."}
            {step === 8 && "حفظٌ وتسميع وورد — ركّبها كما تحب."}
            {step === 9 && "من أين يبدأ يومُك؟ اليوم حلقةٌ تفتتحها من حيث شئت."}
            {step === 10 && "مشاريعك وأهدافك — خزائنُ فيها أدراج فيها مهام."}
        </p>
      </div>

        {step === 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1">
              {CITIES.map((c) => (
                <Chip
                  key={c.name}
                  on={city === c.name}
                  onClick={() => {
                    setCity(c.name)
                    setLoc({ lat: c.lat, lng: c.lng, tz: c.tz })
                    setMethod(c.method)
                    setGeoMsg("")
                    setReached((r) => Math.max(r, 1)) // صلواتُك تظهر الآن
                  }}
                >
                  {c.name}
                </Chip>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={useMyLocation} className="self-start">
              <MapPinIcon />
              استخدم موقعي
            </Button>
            {geoMsg && <p className="text-muted-foreground text-xs">{geoMsg}</p>}
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground flex-none text-xs">خط العرض</label>
              <Input type="number" step="0.0001" value={loc.lat} onChange={(e) => setLoc({ ...loc, lat: +e.target.value })} className="h-8" />
              <label className="text-muted-foreground flex-none text-xs">الطول</label>
              <Input type="number" step="0.0001" value={loc.lng} onChange={(e) => setLoc({ ...loc, lng: +e.target.value })} className="h-8" />
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">طريقة الحساب</span>
              <Help text="تختلف الطرق في زاوية الفجر والعشاء. اختر ما تعمل به بلدك أو مسجدك." />
            </div>
            <div className="flex flex-wrap gap-1">
              {METHODS.map((m) => (
                <Chip key={m.key} on={method === m.key} onClick={() => setMethod(m.key)}>
                  {m.name}
                </Chip>
              ))}
            </div>

            {/* الجاهز لا يُفرَض ولا يمسّ شيئًا إلا بهذه الضغطة الصريحة */}
            <button
              onClick={() => {
                saveSettings({ ...loc, method })
                loadHaithamPreset(true)
              }}
              className="border-border hover:bg-muted mt-1 rounded-md border p-2 text-start transition-colors"
            >
              <span className="text-sm font-medium">أو خُذ جدول هيثم جاهزًا</span>
              <span className="text-muted-foreground block text-[11px] leading-relaxed">
                ضغطةٌ تملأ كل الإعدادات والبلوكات بجدوله كاملًا — قوالبه الثلاثة ووِرده وحفظِه
                وتمرينِه — وتتخطى بقية الإعداد. ومواقيتُك تبقى على ما اخترتَ أعلاه.
              </span>
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed">
              الصلاة تبدأ بالأذان، وبين الأذان والإقامة دعاءٌ لا يُردّ، ثم السنن، ثم صلاةٌ تحتاج
              حضور قلب، ثم أذكارها — فاجعل وقتها يسعها.
            </p>
            {!perPrayer && (
              <>
                <div className="flex items-center gap-2">
                  <Input type="number" min={5} max={180} value={minutes} onChange={(e) => setMinutes(Math.max(5, +e.target.value || 5))} className="h-9 w-24" />
                  <span className="text-muted-foreground text-sm">دقيقة لكل صلاة</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[20, 30, 45, 60].map((m) => (
                    <Chip key={m} on={minutes === m} onClick={() => setMinutes(m)}>
                      {arab(m)} دقيقة
                    </Chip>
                  ))}
                </div>
              </>
            )}
            <Tick
              on={perPrayer}
              label="لكل صلاة مدتها"
              onClick={() => {
                if (!perPrayer) setMins(Object.fromEntries(PRAYER_NAMES.map(([k]) => [k, minutes])))
                setPerPrayer((v) => !v)
              }}
            />
            {perPrayer &&
              PRAYER_NAMES.map(([key, name]) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="w-14 flex-none text-sm">{name}</label>
                  <Input type="number" min={5} max={180} value={mins[key] ?? 45} onChange={(e) => setMins((p) => ({ ...p, [key]: Math.max(5, +e.target.value || 5) }))} className="h-8 w-20" />
                  <span className="text-muted-foreground text-xs">دقيقة</span>
                </div>
              ))}

            {/* قيام الليل سادسُ القائمة: مدتُه هنا مع أخواتها، وموضعُه في خطوته */}
            <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md border p-2">
              <label className="flex-none text-sm font-medium">قيام الليل</label>
              {qiyamOn ? (
                <>
                  <button
                    onClick={() => setQiyamFull(true)}
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-xs",
                      qiyamFull ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    )}
                  >
                    سدس الليل كاملًا
                  </button>
                  <Input
                    type="number"
                    min={10}
                    max={180}
                    value={qiyamMin}
                    onChange={(e) => {
                      setQiyamMin(Math.max(10, +e.target.value || 10))
                      setQiyamFull(false)
                    }}
                    onFocus={() => setQiyamFull(false)}
                    className={cn("h-8 w-20", qiyamFull && "opacity-50")}
                  />
                  <span className="text-muted-foreground text-xs">دقيقة</span>
                  <Help text="سدسُ الليل يطول ويقصر مع الفصول كما قام النبي ﷺ، والدقائق ثابتة. وموضعُه من الليل تختاره في خطوة «قيام الليل»." />
                </>
              ) : (
                <button onClick={() => setQiyamOn(true)} className="text-primary text-xs underline">
                  فعّله
                </button>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              لكل صلاةٍ بنودُها: الأذان، والسنة، وما بين الأذان والإقامة، والصلاة، والأذكار…
              هذه بنودٌ افتراضية — احذف ما لا تفعله وأضف ما تفعله، ولك أن تعود إليها متى شئت.
            </p>
            {PRAYER_GENS.map(([slot, name, gen]) => (
              <PrayerTasksRow key={slot} slot={slot} name={name} gen={gen} />
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-2 text-sm leading-relaxed">
            <p>• يومُك بلوكاتٌ متلاصقة تتحرك مع الصلوات — لا فراغَ بينها أبدًا.</p>
            <p>
              • ما فات وقته لا يسقط: ينتقل إلى بلوك المهام التالي فتقضيه <b>بنصف إنجاز</b> — لأن
              الوقت جزءٌ من العمل. وعكسه <b>التقديم</b>: تؤدي مهمة بلوكٍ لاحق الآن فتُحتسب كاملة.
            </p>
            <p>• في الصلوات لا يُقضى إلا الورد — سائرُ الصلاة لوقتها.</p>
            <p>
              • مشاريعك في <b>خزائن</b>: خزانةٌ فيها أدراج فيها مهام، ولكل مهمة خطواتها — وكلها
              يجري عليها القضاء والتقديم.
            </p>
            <p>• كل ما تختاره الآن تغيّره لاحقًا من الإعدادات و«قالب يومك».</p>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground flex-none text-xs">مجموع نومك بين</span>
              <Input type="number" min={3} max={12} value={hoursMin} onChange={(e) => setHoursMin(Math.max(3, +e.target.value || 3))} className="h-8 w-16" />
              <span className="text-muted-foreground text-xs">و</span>
              <Input type="number" min={3} max={12} value={hoursMax} onChange={(e) => setHoursMax(Math.max(hoursMin, +e.target.value || hoursMin))} className="h-8 w-16" />
              <span className="text-muted-foreground flex-none text-xs">ساعات</span>
              <Help text="الليل يطول ويقصر مع الفصول، فيسعى البرنامج أن يبقى نومُك داخل هذا المدى: إن قصر ليلُك طالت قيلولتُك." />
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">متى تنام؟</span>
              <Help text="الموصى به نمطُ النبي ﷺ: نومٌ بعد العشاء مباشرة، ثم قيامُ الثلث الأخير، ثم نومُ السدس الأخير — مع قيلولة النهار." />
            </div>
            <Tick on={sleepStart === "afterIsha"} label="بعد العشاء مباشرة" sub="نمط النبي ﷺ — الموصى به" onClick={() => setSleepStart("afterIsha")} />
            {[2, 3].map((k) => (
              <Tick key={k} on={sleepStart === k} label={`أسهر إلى ${SIXTH_NAMES[k]}`} onClick={() => setSleepStart(k)} />
            ))}
            <Tick
              on={qaylulah}
              label="قيلولة في النهار"
              sub="نومة توازنٍ تُكمل مجموعك — وتُقصّ إلى دورات نوم كاملة (~٩٠ دقيقة) فلا تُوقَظ في منتصف دورة"
              onClick={() => setQaylulah((v) => !v)}
            />
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-3">
            <Tick on={qiyamOn} label="أقوم الليل" onClick={() => setQiyamOn((v) => !v)} />
            {qiyamOn && (
              <>
                <div className="text-muted-foreground text-xs">يبدأ عند:</div>
                <div className="flex flex-wrap gap-1">
                  {[1, 2, 3, 4, 5]
                    .filter((k) => sleepStart === "afterIsha" || k > (sleepStart as number))
                    .map((k) => (
                      <Chip key={k} on={qiyamSixth === k} onClick={() => setQiyamSixth(k)}>
                        {SIXTH_NAMES[k]}
                      </Chip>
                    ))}
                </div>
                <Tick
                  on={qiyamFull}
                  label="سدسًا كاملًا من الليل"
                  sub="كما قام النبي ﷺ: ينام نصفه ويقوم سدسه — فتطول قومتُك مع طول الليل"
                  onClick={() => setQiyamFull(true)}
                />
                <Tick on={!qiyamFull} label="بمدة ثابتة" onClick={() => setQiyamFull(false)} />
                {!qiyamFull && (
                  <div className="flex items-center gap-2">
                    <Input type="number" min={10} max={180} value={qiyamMin} onChange={(e) => setQiyamMin(Math.max(10, +e.target.value || 10))} className="h-8 w-20" />
                    <span className="text-muted-foreground text-xs">دقيقة</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === 6 && (
          <div className="flex flex-col gap-3">
            <Tick
              on={fasting}
              label="أصوم الاثنين والخميس"
              sub="تسقط وجبةُ النهار المعلَّمة في يومي الصيام تلقائيًّا"
              onClick={() => setFasting((v) => !v)}
            />
            <div className="text-muted-foreground text-xs">وجباتك — كلٌّ بعد صلاتها:</div>
            {meals.map((meal, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1">
                <Input value={meal.name} onChange={(e) => setMeals((p) => p.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} className="h-8 w-28" />
                {PRAYER_NAMES.map(([k, name]) => (
                  <Chip key={k} on={meal.prayer === k} onClick={() => setMeals((p) => p.map((x, j) => (j === i ? { ...x, prayer: k } : x)))}>
                    {name}
                  </Chip>
                ))}
                <button
                  onClick={() => setMeals((p) => p.map((x, j) => (j === i ? { ...x, fastingSkip: !x.fastingSkip } : x)))}
                  className={cn("rounded border px-1.5 py-0.5 text-[11px]", meal.fastingSkip ? "border-amber-500 text-amber-600" : "border-border text-muted-foreground")}
                  title="تسقط في يومي الصيام"
                >
                  صيام
                </button>
                <button onClick={() => setMeals((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive" aria-label="حذف الوجبة">
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <Input value={newMeal} onChange={(e) => setNewMeal(e.target.value)} placeholder="وجبة أخرى…" className="h-8 w-32" />
              <Button
                size="icon"
                variant="outline"
                className="size-8"
                aria-label="أضف وجبة"
                onClick={() => {
                  if (!newMeal.trim()) return
                  setMeals((p) => [...p, { name: newMeal.trim(), prayer: "asr" }])
                  setNewMeal("")
                }}
              >
                <PlusIcon />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <label className="text-muted-foreground flex-none text-xs">وزنك</label>
              <Input type="number" min={30} max={250} value={weight} onChange={(e) => setWeight(+e.target.value || 70)} className="h-8 w-20" />
              <span className="text-muted-foreground text-[11px]">كجم</span>
              <label className="text-muted-foreground flex-none text-xs">طولك</label>
              <Input type="number" min={100} max={230} value={height} onChange={(e) => setHeight(+e.target.value || 170)} className="h-8 w-20" />
              <span className="text-muted-foreground text-[11px]">سم</span>
              <Help text="منهما تُحسب سعراتك وبروتينك في لوحة اليوم — وسجّلهما كل شهر من الإعدادات ليُرى الأثر." />
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="flex flex-col gap-3">
            <Tick on={workoutOn} label="أتمرّن" onClick={() => setWorkoutOn((v) => !v)} />
            {workoutOn && (
              <>
                <Tick
                  on={wMode === "cycle"}
                  label="دورة لا تعرف الأسبوع"
                  sub="يوم تمرين فيوم راحة — لا فرق عندك بين جمعةٍ وغيرها"
                  onClick={() => setWMode("cycle")}
                />
                {wMode === "cycle" && (
                  <Tick on={wRest} label="يوم راحة بين كل تمرينين" onClick={() => setWRest((v) => !v)} />
                )}
                <Tick on={wMode === "weekly"} label="أيام محددة من الأسبوع" onClick={() => setWMode("weekly")} />
                {wMode === "weekly" && (
                  <div className="flex flex-wrap gap-1">
                    {["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"].map((name, i) => (
                      <Chip key={i} on={wDays.includes(i)} onClick={() => setWDays((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort()))}>
                        {name}
                      </Chip>
                    ))}
                  </div>
                )}
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  تمارينك نفسها — أسماؤها وأوزانها ونسخها المتناوبة — تبنيها من «الإعدادات ←
                  التمرين» بعد الإعداد. ولك أن تجعل ليومٍ نسختين تتعاقبان موعدًا بعد موعد.
                </p>
              </>
            )}
          </div>
        )}

        {step === 8 && (
          <div className="flex flex-col gap-3">
            <Tick on={hifzOn} label="نظام الحفظ والمراجعة" sub="مُدارٌ يعرف موضعك ويتقدّم بك وحده كلما أنجزت" onClick={() => setHifzOn((v) => !v)} />
            {hifzOn && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Tick on={compHifz} label="حفظ" sub="ربعٌ يُحفظ ثم يُكرَّر" onClick={() => setCompHifz((v) => !v)} />
                  <Tick on={compReview} label="تسميع" sub="جزءٌ يوميًّا مما مضى" onClick={() => setCompReview((v) => !v)} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-muted-foreground flex-none text-xs">أحفظ الآن في الجزء</label>
                  <Input type="number" min={4} max={30} value={hifzJuz} onChange={(e) => setHifzJuz(Math.min(30, Math.max(4, +e.target.value || 4)))} className="h-8 w-20" />
                </div>
              </>
            )}
            <Tick on={wirdOn} label="الورد في السنن" sub="وردُك يُقسَّم على السنن الرواتب — كل سنّة نصيبها، وما فات لا يُتخطّى" onClick={() => setWirdOn((v) => !v)} />
            {wirdOn && (
              <>
                <Tick on={wirdMode === "reading"} label="قراءة بمقدار" onClick={() => setWirdMode("reading")} />
                {wirdMode === "reading" && (
                  <Input value={wirdAmount} onChange={(e) => setWirdAmount(e.target.value)} placeholder="ربع حزب…" className="h-8 w-32" />
                )}
                <Tick
                  on={wirdMode === "tathbeet"}
                  label="مربوط بالحفظ (تثبيت)"
                  sub="يقرأ بك ما حول موضع حفظك فيثبّته — يحتاج نظام الحفظ مفعّلًا"
                  onClick={() => {
                    setWirdMode("tathbeet")
                    if (!hifzOn) setHifzOn(true)
                  }}
                />
              </>
            )}
          </div>
        )}

        {step === 9 && (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs leading-relaxed">
              اليوم حلقةٌ: ما قبل بدايتك يظهر في آخر يومك، والترتيب محفوظ. هذه حدودُ يومك كما
              ركّبتَه — اختر أيّها يفتتحه:
            </p>
            {startCandidates(composed).map((c: { id: string; title: string }) => (
              <Tick
                key={c.id}
                on={dayStartId === c.id}
                label={c.title}
                sub={c.id === "fajr" ? "المعتاد — يومٌ من فجرٍ إلى فجر، أربعٌ وعشرون ساعة" : undefined}
                onClick={() => setDayStartId(c.id)}
              />
            ))}
          </div>
        )}

        {step === 10 && (
          <div className="flex flex-col gap-2 text-sm leading-relaxed">
            <p>
              ستجد في «الخزائن» {hifzOn || workoutOn ? "خزانةَ «روتين» جاهزةً" : "بابَ خزائنك"} —
              {hifzOn || workoutOn
                ? " فيها " +
                  [hifzOn && "درج «قرآن»", workoutOn && "درج «تمرين»"].filter(Boolean).join(" و") +
                  "؛ حذفُها يطفئ أنظمتها بعد استئذانك."
                : " أنشئ خزانةً لكل مشروع، وأدراجًا لأهدافه، ومهامَّ لكل درج."}
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              كل مهمة لها خطوات، وتوقيتٌ في بلوكٍ من يومك، وتكرارٌ إن شئت — وكلها يجري عليها
              القضاء والتقديم. وأحداث Google تُعرض شفافةً خلف جدولك للعرض فقط، وتربطها من
              الإعدادات.
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              وكل هذا في جهازك وحده. إن أردت جدولك على أكثر من جهاز، فمن «الإعدادات ← الحساب
              والمزامنة» تدخل ببريدك — اختيارٌ لا شرط.
            </p>
            <p className="pt-1 font-medium">بسم الله — يومُك الآن بيدك تبنيه.</p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              رجوع
            </Button>
          )}
          <span className="text-muted-foreground text-xs">
            {arab(step + 1)} من {arab(STEPS.length)}
          </span>
          <Button
            className="ms-auto"
            onClick={() => {
              if (step < STEPS.length - 1) {
                setStep((s) => s + 1)
                setReached((r) => Math.max(r, step + 2))
              } else finish()
            }}
          >
            {step < STEPS.length - 1 ? "التالي" : "ابدأ"}
          </Button>
        </div>
    </div>
    </div>
  )
}
