"use client"

// المعالج الأول — رحلةُ كلِّ مستخدمٍ جديد، كما رسمها صاحب البرنامج في ٢٦ أغسطس:
// حسابٌ أولًا، ثم الموقع، فمدد الصلاة، فقواعدُ الفهم، فالنوم بدوراته الكاملة
// ونمطِ النبي ﷺ الموصى به، فالقيام في أسداس الليل، فالصيام والطعام، فالتمرين،
// فالقرآن، فبداية اليوم، فالخزائن — ثم تقويمٌ يبنيه صاحبُه بيده.
//
// كل الاختيارات تُركَّب قالبًا واحدًا عبر composeDayTemplate (دالة محضة مفحوصة)
// عند «ابدأ» — فالمعالج واجهةٌ فقط ولا منطقَ زمنيًّا فيه.
import { useMemo, useState, useSyncExternalStore } from "react"
import { CheckIcon, MapPinIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Help } from "@/components/help"
import { arab } from "@/lib/format"
import { onSyncChange, sendMagicLink, signInWithGoogle, syncState } from "@/lib/sync"
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
  saveSettings,
  setPrayerMinutes,
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
  "أهلًا بك",
  "أين أنت؟",
  "مدة الصلاة",
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

export function Onboarding() {
  const [step, setStep] = useState(0)
  // الحساب
  useSyncExternalStore(onSyncChange, () => JSON.stringify(syncState()), () => "{}")
  const sync = syncState()
  const [email, setEmail] = useState("")
  const [mailMsg, setMailMsg] = useState("")
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
  const [dayStartId, setDayStartId] = useState<string | null>(null)

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
      },
      () => setGeoMsg("تعذّر تحديد موقعك — اختر مدينتك أو أدخل الإحداثيات")
    )
  }

  const canNext = step !== 0 || !!sync.user

  return (
    <Dialog open>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{STEPS[step]}</DialogTitle>
          <DialogDescription>
            {step === 0 && "حسابُك يحفظ جدولك على كل أجهزتك — به يبدأ كل شيء."}
            {step === 1 && "جدولك يُبنى على مواقيت الصلاة، فيتحرك معها كل يوم."}
            {step === 2 && "كم تحتاج من الوقت لصلاتك؟"}
            {step === 3 && "دقيقتان تفهم بهما البرنامج كله."}
            {step === 4 && "نومُك يصنع يومك — فهو أول ما يُرسم."}
            {step === 5 && "الليل من المغرب إلى الفجر ستةُ أجزاء — ضع قيامك حيث شئت."}
            {step === 6 && "متى تأكل؟ وهل تصوم الاثنين والخميس؟"}
            {step === 7 && "أيام تمرينك وطريقتها — والتمارين نفسها تبنيها من الإعدادات."}
            {step === 8 && "حفظٌ وتسميع وورد — ركّبها كما تحب."}
            {step === 9 && "من أين يبدأ يومُك؟ اليوم حلقةٌ تفتتحها من حيث شئت."}
            {step === 10 && "مشاريعك وأهدافك — خزائنُ فيها أدراج فيها مهام."}
          </DialogDescription>
        </DialogHeader>

        {step === 0 && (
          <div className="flex flex-col gap-3">
            {sync.user ? (
              <p className="text-sm">
                متّصل بـ <span className="font-medium">{sync.user.email}</span> ✅
              </p>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="بريدك…"
                    className="h-9"
                  />
                  <Button
                    disabled={!email.includes("@")}
                    onClick={async () => setMailMsg(await sendMagicLink(email))}
                  >
                    أرسل رابط الدخول
                  </Button>
                </div>
                {mailMsg && <p className="text-muted-foreground text-xs">{mailMsg}</p>}
                <Button variant="outline" onClick={() => signInWithGoogle()}>
                  الدخول بحساب Google
                </Button>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  افتح الرابط من بريدك وستعود إلى هنا متّصلًا — ثم أكمل الإعداد.
                </p>
              </>
            )}
          </div>
        )}

        {step === 1 && (
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
          </div>
        )}

        {step === 2 && (
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
                on={dayStartId === c.id || (dayStartId === null && c.id === composed.blocks[0].id)}
                label={c.title}
                sub={c.id === composed.blocks[0].id ? "كما رُكّب يومك — النومة التي تسبق الفجر" : undefined}
                onClick={() => setDayStartId(c.id === composed.blocks[0].id ? null : c.id)}
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
            disabled={!canNext}
            onClick={() => {
              if (step === 2) {
                // المدد تُطبَّق على القالب المركّب عند البناء — لا حاجة لحفظ هنا
              }
              if (step < STEPS.length - 1) setStep((s) => s + 1)
              else finish()
            }}
          >
            {step === 0 && !sync.user ? "بانتظار دخولك…" : step < STEPS.length - 1 ? "التالي" : "ابدأ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
