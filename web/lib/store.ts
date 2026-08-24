"use client"

// المخزن — يربط المحرك المُتحقَّق منه بالواجهة، وكل الحالة في localStorage
import {
  buildRange,
  unitStart,
  setScheduleConfig,
  taskSlots,
  DEFAULT_TEMPLATES,
  DEFAULT_WEEK_PLAN,
} from "@/lib/engine/schedule.js"
import { addDays, daysBetween, toIso, arab, dow } from "@/lib/engine/dates.js"
import { setPrayerConfig } from "@/lib/engine/prayers.js"
import { isMonotone, rotateTemplate, startCandidates } from "@/lib/engine/layout.js"
import { emptyCabinets, itemsForDay, repeatLabel } from "@/lib/engine/cabinets.js"
import {
  setQuranCompletion,
  setQuranConfig,
  DEFAULT_QURAN,
  clearQuranCache,
  quranStateFor,
  quranTaskLines,
  tathbeetLabels,
  tathbeetPoolKey,
} from "@/lib/engine/quran.js"
import { setWorkoutCompletion, setWorkoutConfig, DEFAULT_WORKOUT, workoutPlan, workoutDayType, workoutTitle } from "@/lib/engine/workout.js"

// بند داخل بلوك: معرّفه ثابت، فالتأشير والقضاء والتقديم تُمسك به لا بموضع السطر
export type Item = {
  id: string
  text: string
  note?: boolean // سطر شرح لا يُؤشَّر
  pool?: string // مجمع أخطاء القرآن
  quran?: boolean // بند من بنود القرآن (مهمة يومية عائمة)
  taskId?: string // مهمة يدوية أضافها المستخدم
  cabItemId?: string // مهمة من خزانة
  depth?: number // مهمة فرعية تُزاح للداخل
  hint?: string // سطر تعريفي صغير (الخزانة والدرج والموعد النهائي)
  external?: boolean // بند مسحوب من Google
}

export type Ev = {
  id: string
  unit?: string
  slot?: string
  title: string
  start: string // "YYYY-MM-DDTHH:MM" بجدار الرياض
  end: string
  colorId: number
  items: Item[]
  transparent?: boolean
  done?: boolean
  external?: boolean
  account?: string // بريد حساب Google المصدر (للأحداث الخارجية)
  trainDate?: string // بلوك تمرين قضاء: تاريخ الجلسة الأصلية (أمس)
}

// يوم بداية الجدول — إعدادٌ يُغيّره المستخدم من «بداية جديدة»، لا ثابتٌ في الشيفرة.
// (ارتباط حيّ: من يستورده يرى قيمته الجديدة بعد إعادة الضبط)
export let SCHEDULE_START = "2026-08-24"
let BLOCK_START = SCHEDULE_START // نافذة التوليد: كتل ٢٨ يومًا من يوم البداية

// كل بداية جديدة ترفع أرقام المفاتيح فتبدأ الحالة فارغة (الإعدادات وحدها تبقى)
const K = {
  done: "hc.done.v6",
  checks: "hc.checks.v6",
  tasks: "hc.tasks.v6", // لكل بلوك مهامه: تاريخ ← slot ← مهام
  food: "hc.food.v6",
  settings: "hc.settings.v2",
  pulled: "hc.pulled.v6",
  lastSeen: "hc.lastseen.v6",
  gym: "hc.gym.v6",
  late: "hc.late.v6",
  mistakes: "hc.mistakes.v6",
  cabinets: "hc.cabinets.v1", // الخزانات والأدراج والمهام — بنية جديدة
}

const isClient = typeof window !== "undefined"

function load<T>(key: string, fallback: T): T {
  if (!isClient) return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
// ختم آخر تعديل لكل مفتاح — عليه يقوم الدمج بين الأجهزة (آخر كتابة تفوز)
const STAMP = "hc.stamps.v1"
let stamps: Record<string, string> = load<Record<string, string>>(STAMP, {})

function save(key: string, val: unknown) {
  if (!isClient) return
  localStorage.setItem(key, JSON.stringify(val))
  if (key !== STAMP) {
    stamps[key] = new Date().toISOString()
    localStorage.setItem(STAMP, JSON.stringify(stamps))
  }
}

let done = load<Record<string, boolean>>(K.done, {})
let checks = load<Record<string, string[]>>(K.checks, {})
// مهام يدوية لكل بلوك مستقبِل: تاريخ الوحدة ← slot ← مهام لها معرّفات ثابتة
export type UserTask = { id: string; text: string }
let tasks = load<Record<string, Record<string, UserTask[]>>>(K.tasks, {})
let food = load<Record<string, { kcal: number; p: number; c: number; f: number }>>(K.food, {})
// سجل التمرين: تاريخ ← مفتاح خلية ("exKey:setIdx" أو "exKey:setIdx:partKey") ← منجَز
let gym = load<Record<string, Record<string, boolean>>>(K.gym, {})
// البنود المؤدّاة قضاءً (خارج وقتها) — نصف إنجاز: "eventId:lineIdx"
let late = load<Record<string, boolean>>(K.late, {})
// أخطاء القرآن: مجمع (rv:جزء / hz:جزء:ربع / tb:جزء:نصف) ← قائمة أخطاء
export type Mistake = { id: string; ayah: string; word: string; addedDate: string }
let mistakes = load<Record<string, Mistake[]>>(K.mistakes, {})

// ── الخزانات: خزانة (أمر جلل) ← أدراج (أهداف جزئية) ← مهام في بلوكات المهام ──
export type Repeat =
  | { mode: "once" }
  | { mode: "weekly"; days: number[] }
  | { mode: "everyN"; n: number }
export type Cabinet = { id: string; name: string; goal?: string; deadline?: string; doneAt?: string }
export type Drawer = Cabinet & { cabinetId: string }
export type CabItem = {
  id: string
  drawerId: string
  title: string
  subtasks?: { id: string; title: string }[]
  slot?: string // بلوك المهام الذي توضع فيه — وبلا تحديد تذهب إلى أول بلوك
  repeat?: Repeat
  from: string
  deadline?: string
  doneAt?: string
}
export type CabData = { cabinets: Cabinet[]; drawers: Drawer[]; items: CabItem[] }
// مهمة مستحقّة اليوم مع سياقها
export type Due = { item: CabItem; drawer?: Drawer; cabinet?: Cabinet; deadline: string | null }
let cab = load<CabData>(K.cabinets, emptyCabinets())
// ورد التثبيت: السنن المشاركة بترتيبها الزمني [slot البلوك، معرّف البند]
const DEFAULT_WIRD: [string, string][] = [
  ["fajr", "sunnah"],
  ["fajr", "duha"],
  ["dhuhr", "sunnahBefore"],
  ["dhuhr", "sunnahAfter"],
  ["asr", "sunnah"],
  ["maghrib", "sunnah"],
  ["isha", "sunnahBefore"],
  ["isha", "sunnahAfter"],
]

// أنظمة المستخدم بأنواعها المفتوحة — فالافتراض بذرةٌ لا سقف: تُزاد التمارين وتُنقص
// أيام الدورة ويُبدَّل موضع الحفظ، والنوع لا يمنع شيئًا من ذلك.
export type Exercise = {
  name: string
  sets: number
  lo: number
  hi: number
  w0: number | null
  inc: number
  rest: number
}
export type WorkoutDay = { title: string; header: string; items: unknown[] }
export type WorkoutCfg = {
  start: string
  offTitle: string
  restBetween: boolean
  exercises: Record<string, Exercise>
  days: WorkoutDay[]
}
export type Template = { name?: string; start: Anchor; blocks: Block[] }
export type QuranCfg = {
  mode: string
  date: string
  reviewJuz: number
  hifzJuz: number
  hifzQuarter: number
  hifzMode: string
  repeats: number
  wirdSlots: number
}

// الموقع وطريقة الحساب من إعدادات المستخدم — والافتراض الرياض بمعايير أم القرى
const DEFAULT_SETTINGS = {
  clientId: "",
  weight: 70,
  accounts: [] as string[],
  notify: false,
  push: false,
  lat: 24.7136,
  lng: 46.6753,
  tz: 3,
  method: "ummAlQura",
  asrFactor: 1, // ظل المثل، و٢ للحنفية
  startDate: "2026-08-24", // يوم بداية الجدول — ما قبله لا يُعرض
  onboarded: false, // هل أتمّ المستخدم الإعداد الأول
  wirdEnabled: true, // متابعة الورد في السنن
  hifzEnabled: true, // نظام الحفظ والمراجعة
  workoutEnabled: true, // نظام التمرين
  // ورد التثبيت: السنن المشاركة بترتيبها الزمني [slot البلوك، معرّف البند]
  wird: DEFAULT_WIRD,
  // قوالب الأيام وخطة الأسبوع — يحرّرها المستخدم من «قالب يومك»
  templates: DEFAULT_TEMPLATES as unknown as Record<string, Template>,
  weekPlan: DEFAULT_WEEK_PLAN as string[],
  quran: DEFAULT_QURAN as QuranCfg,
  workout: DEFAULT_WORKOUT as unknown as WorkoutCfg,
  // بداية اليوم: أيّ بلوك يفتتح الوحدة وبأيّ مرساة — واحدة لكل القوالب، وإلا
  // تداخلت الوحدات. null = كما كُتب القالب (نومة الثلث الأخير في الجاهز).
  dayStart: null as { blockId?: string; anchor?: Anchor } | null,
  // القضاء والتقديم: القضاء أداءُ الفائت بعد وقته بنصف إنجاز، والتقديم أداءُ
  // اللاحق قبل وقته من يومه بإنجاز كامل.
  qada: {
    enabled: true,
    credit: 0.5, // حظّ البند المقضيّ من الإنجاز
    crossDay: true, // ترحيل ما لم يُنجز من الأمس إلى اليوم (يوم واحد)
    early: true, // إتاحة التقديم
  },
}
export type Settings = typeof DEFAULT_SETTINGS
const stored = load<Partial<Settings> | null>(K.settings, null)
export const settings: Settings = Object.assign({} as Settings, DEFAULT_SETTINGS, stored || {})
// من كان له إعدادات محفوظة فهو مستخدم قائم — لا يُعرض عليه الإعداد الأول
if (stored && stored.onboarded === undefined) settings.onboarded = true

// المحركات تقرأ إعداداتها من هنا، فتُطبَّق عند الإقلاع وعند كل حفظ
function applyEngineConfig() {
  SCHEDULE_START = settings.startDate
  BLOCK_START = settings.startDate
  const { lat, lng, tz, method, asrFactor } = settings
  setPrayerConfig({ lat, lng, tz, method, asrFactor })
  setQuranConfig({
    ...settings.quran,
    enabled: settings.hifzEnabled,
    wird: settings.wird, // مولّد البلوك يقرأ منها موضع كل سنّة، فلا يُفهرَس برقم
    wirdSlots: settings.wird.length,
  })
  setWorkoutConfig(settings.workout)
  setScheduleConfig({
    templates: settings.templates,
    weekPlan: settings.weekPlan,
    dayStart: settings.dayStart,
  })
}
applyEngineConfig()

// ── إشعار React بالتغييرات ──
let version = 0
const listeners = new Set<() => void>()
function notify() {
  version++
  clearQuranCache() // الإنجاز قد يغيّر تقدّم الأيام التالية
  listeners.forEach((fn) => fn())
}
export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export function getVersion() {
  return version
}

export function todayIso(): string {
  const t = new Date()
  return toIso(t.getFullYear(), t.getMonth() + 1, t.getDate())
}

export function nowStamp(): string {
  const n = new Date()
  const p = (x: number) => String(x).padStart(2, "0")
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}T${p(n.getHours())}:${p(n.getMinutes())}`
}

// اليوم عند هيثم يبدأ بنومة الثلث الأخير التي تسبق الفجر لا بمنتصف الليل ولا بالفجر:
// قبل مطلع الثلث الأخير (نحو الواحدة ليلًا) ما زلنا في وحدة الأمس، ومن النومة تبدأ وحدة اليوم
let cuCache = { at: "", val: "" } // تُستدعى في حلقات ساخنة — تُحسب مرة كل دقيقة
export function currentUnit(): string {
  const now = nowStamp()
  if (cuCache.at === now) return cuCache.val
  const t = todayIso()
  const u = now >= unitStart(t) ? t : addDays(t, -1)
  const val = u < SCHEDULE_START ? SCHEDULE_START : u // قبل أول وحدة: أول وحدة هي الجارية
  cuCache = { at: now, val }
  return val
}

// ── التقدّم مشروط بالإنجاز الفعلي ──
// الوحدات الماضية (انتهت بمغربها) غير المعلَّمة لا تتقدم، والوحدة الحالية فصاعدًا يُفترض إنجازها
if (isClient) {
  setQuranCompletion((d: string) => {
    if (d >= currentUnit()) return { review: true, hifz: true }
    const dn = !!done[`${d}#quran`]
    const arr = checks[`${d}#quran`] || []
    return { review: dn || arr.includes("review"), hifz: dn || arr.includes("hifz") }
  })
  // إنجاز التمرين لكل تمرين على حدة: الفائت وحده يتجمّد تقدّمه
  setWorkoutCompletion((d: string, exKey: string) => {
    if (d >= currentUnit()) return true
    if (done[`${d}#train`]) return true // تعليم الجلسة كلها ✅
    return exerciseComplete(d, exKey)
  })
}

export function isDone(id: string): boolean {
  return !!done[id]
}

// ── سجل التمرين التفاعلي ──
export type PlanItem = {
  key: string
  kind: "reps" | "superset" | "failure" | "hold"
  name: string
  sets: number
  rest: number
  reps?: number
  weight?: number | null
  seconds?: number
  note?: string
  lo?: number
  hi?: number
  inc?: number
  parts?: { key: string; name: string; reps: number; weight: number | null }[]
}
export type Plan = { type: number; title: string; items: PlanItem[] }

export function planFor(dateIso: string): Plan | null {
  return workoutPlan(dateIso) as Plan | null
}

const cell = (exKey: string, setIdx: number, part?: string) =>
  part ? `${exKey}:${setIdx}:${part}` : `${exKey}:${setIdx}`

export function cellDone(d: string, exKey: string, setIdx: number, part?: string): boolean {
  return !!gym[d]?.[cell(exKey, setIdx, part)]
}

export function toggleCell(d: string, exKey: string, setIdx: number, part?: string) {
  const k = cell(exKey, setIdx, part)
  const day = { ...(gym[d] || {}) }
  if (day[k]) delete day[k]
  else day[k] = true
  if (Object.keys(day).length) gym[d] = day
  else delete gym[d]
  save(K.gym, gym)
  notify()
  return !!day[k]
}

// جلسة مكتملة؟ (السوبر ست يتطلب الطرفين)
export function setComplete(d: string, item: PlanItem, setIdx: number): boolean {
  if (item.kind === "superset")
    return (item.parts || []).every((p) => cellDone(d, item.key, setIdx, p.key))
  return cellDone(d, item.key, setIdx)
}

export function setsDoneCount(d: string, item: PlanItem): number {
  let n = 0
  for (let i = 0; i < item.sets; i++) if (setComplete(d, item, i)) n++
  return n
}

// تمرين مكتمل = كل جلساته. يُستخدم لتقدّم الوزن والعدات
export function exerciseComplete(d: string, exKey: string): boolean {
  const plan = workoutPlan(d) as Plan | null
  if (!plan) return false
  for (const item of plan.items) {
    if (item.key === exKey) return setsDoneCount(d, item) >= item.sets
    // التمرين قد يكون طرفًا في سوبر ست
    if (item.kind === "superset" && (item.parts || []).some((p) => p.key === exKey)) {
      let n = 0
      for (let i = 0; i < item.sets; i++) if (cellDone(d, item.key, i, exKey)) n++
      return n >= item.sets
    }
  }
  return false
}

export function sessionProgress(d: string): { done: number; total: number } {
  const plan = workoutPlan(d) as Plan | null
  if (!plan) return { done: 0, total: 0 }
  let done2 = 0,
    total = 0
  for (const item of plan.items) {
    total += item.sets
    done2 += setsDoneCount(d, item)
  }
  return { done: done2, total }
}

export function resetWorkout(d: string) {
  delete gym[d]
  save(K.gym, gym)
  notify()
}

// نافذة «تقرير أمس»: تظهر مرة واحدة عند أول فتح في كل وحدة جديدة
export function popupUnitIfNew(): { prev: string; cur: string } | null {
  if (!isClient) return null
  const cur = currentUnit()
  if (load<string>(K.lastSeen, "") === cur) return null
  return { prev: addDays(cur, -1), cur }
}
export function markPopupSeen(cur: string) {
  save(K.lastSeen, cur)
}

// نهاية النافذة: تغطي دومًا كتلة شهر التمرين الجارية كاملة
function windowEnd(): string {
  const off = Math.max(0, daysBetween(BLOCK_START, todayIso()))
  return addDays(BLOCK_START, (Math.floor(off / 28) + 1) * 28 - 1)
}

// البلوكات التي تستقبل مهام Google: بلوكات العمل/الأسرة والراحة
const GOOGLE_HOST_SLOTS = ["quran", "work1", "work2", "work3", "family", "rest"]

function fmt12Short(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  const ap = h < 12 ? "ص" : "م"
  const h12 = h % 12 || 12
  return m === 0 ? `${arab(h12)} ${ap}` : `${arab(h12)}:${arab(String(m).padStart(2, "0"))} ${ap}`
}

// البنود القابلة للتأشير (ما عدا أسطر الشرح)
export const checkable = (ev: Ev): Item[] => ev.items.filter((i) => !i.note)

// ── التثبيت متتابع: أنصاف الأحزاب الثمانية تُقرأ بالترتيب لا بحسب موضع السنّة ──
// ترتيب السنن زمنيًا: [slot الحدث، معرّف البند] — من إعدادات المستخدم،
// فمن غيّر قالبه أو أراد ورده في سنن أخرى عدّل القائمة ولم يمسّ الشيفرة
const wirdSeq = (): [string, string][] => settings.wird



// نصف الحزب المعروض في السنّة i = i − (عدد السنن الفائتة قبلها)
// فما فات لا يُتخطّى: الصلاة التالية تبدأ من حيث توقّف
function computeShift(unitEvents: Ev[], st: { hifzMode: string }, now: string): number[] {
  const out: number[] = []
  let missed = 0
  const seq = wirdSeq()
  for (let i = 0; i < seq.length; i++) {
    out[i] = i - missed
    const [slot] = seq[i]
    const ev = unitEvents.find((e) => e.slot === slot)
    if (!ev) continue
    const itemId = seq[i][1]
    if (ev.end <= now && !checksFor(ev.id).includes(itemId)) missed++ // فاتت ولم تُقرأ
  }
  return out
}


// إنجاز تلقائي: البلوك يُعدّ منجزًا متى أُنجزت كل بنوده (أو كل جلسات تمرينه)
export function isAutoDone(ev: Ev): boolean {
  if (ev.external) return false
  const items = checkable(ev)
  if (!items.length) return false
  const marked = new Set(checksFor(ev.id))
  return items.every((i) => marked.has(i.id))
}

// ── نظام القضاء: البلوك الفائت تنتقل بنوده غير المنجزة إلى البلوك المستقبِل القادم ──
// المستقبِلات بالترتيب الزمني: بلوكات المهام — والنوم والصلوات لا تستقبل شيئًا.
// ومصدرها القوالب نفسُها (b.task) لا قائمةٌ مكتوبة هنا، فمن صنع بلوك مهام جديدًا
// صار مستقبِلًا مثلها بلا تعديل سطر واحد.
const WORK_SLOTS = () => taskSlots()
// البلوكات التي تقبل مهامك اليدوية — هي نفسها بلوكات المهام
export const TASK_SLOTS = () => taskSlots()

export type Makeup = {
  destId: string
  srcId: string
  srcTitle: string
  srcStart: string
  itemId: string
  text: string
  kind?: "line" | "train" // train: بطاقة تمرين تُفتح من بلوك العمل
  crossDay?: boolean // مُرحَّل من أمس (يوم واحد فقط)
}

// البلوك فائت: انتهى وقته وفيه بنود لم تُنجز (والتمرين: جلسات ناقصة)
// تعليمه ✅ يدويًا تصريحٌ بإنجازه كاملًا: يُغلق فلا يفوت ولا تُرحَّل بنوده
export function isMissed(ev: Ev, now: string): boolean {
  if (ev.external || ev.done || ev.end > now) return false
  // بلوك «مهام» الصباحي لا يفوت: مهمتاه متاحتان في كل بلوك مهام طوال اليوم
  if (ev.slot === "quran") return false
  const items = checkable(ev)
  if (!items.length) return false
  const marked = new Set(checksFor(ev.id))
  return items.some((i) => !marked.has(i.id))
}

// خريطة القضاء:
//  • داخل اليوم: البند الفائت ينتقل إلى أول بلوك مستقبِل قادم (عمل/أسرة ثم زوجة/راحة)
//  • من الأمس: كل ما لم يُنجز — أيًّا كان بلوكه، حتى مهام العمل — ينتقل إلى «راحة أو تعويض» وحده
export function makeupMap(events: Ev[], now: string): Map<string, Makeup[]> {
  const map = new Map<string, Makeup[]>()
  if (!settings.qada.enabled) return map
  const cu = currentUnit()
  const sorted = events
    .filter((e) => e.unit === cu)
    .sort((a, b) => (a.start < b.start ? -1 : 1))
  // البلوكات المستقبِلة التي لم ينتهِ وقتها بعد، بالترتيب
  const dests = sorted.filter((e) => !e.external && WORK_SLOTS().includes(e.slot || "") && e.end > now)
  if (!dests.length) return map
  const push = (destId: string, m: Makeup) => {
    const list = map.get(destId) || []
    list.push(m)
    map.set(destId, list)
  }

  // ── تعويض الأمس: بنود أمس غير المنجزة تُوزَّع بالتناوب على بلوكات اليوم المستقبِلة
  //    (راحة ← عمل/أسرة ← زوجة…) واحدًا تلو الآخر — يوم واحد فقط ──
  const prevU = addDays(cu, -1)
  if (settings.qada.crossDay && prevU >= SCHEDULE_START) {
    let turn = 0
    for (const ev of events) {
      if (ev.unit !== prevU || ev.external || ev.done) continue
      const marked = new Set(checksFor(ev.id))
      for (const item of checkable(ev)) {
        if (marked.has(item.id)) continue
        const dest = dests[turn++ % dests.length]
        push(dest.id, {
          destId: dest.id,
          srcId: ev.id,
          srcTitle: `${ev.title} — أمس`,
          srcStart: ev.start,
          itemId: item.id,
          crossDay: true,
          text: item.text,
        })
      }
    }
  }

  for (const ev of sorted) {
    if (ev.external || ev.done || ev.end > now) continue
    if (ev.slot === "quran") continue // مهمتا اليوم عائمتان بإنجاز كامل، فلا تُقضيان
    const marked = new Set(checksFor(ev.id))
    const pending = checkable(ev).filter((i) => !marked.has(i.id))
    if (!pending.length) continue
    // أول بلوك عمل يبدأ بعد نهاية البلوك الفائت (أو الجاري الآن)
    const dest = dests.find((d) => d.start >= ev.end) || dests[0]
    for (const item of pending)
      push(dest.id, {
        destId: dest.id,
        srcId: ev.id,
        srcTitle: ev.title,
        srcStart: ev.start,
        itemId: item.id,
        text: item.text,
      })
  }
  return map
}

// ── التقديم: أداء بنود بلوك قادم في بلوك مستقبِل سابق له من الوحدة نفسها ──
// مثاله: إنجاز مهام عمل ما بعد العصر في بلوك الصباح، أو مهام «راحة» الليلة الآن.
// وهو عكس القضاء: في وقته من يومه فيُحتسب إنجازًا كاملًا لا نصفًا.
export type Early = {
  destId: string
  srcId: string
  srcTitle: string
  srcStart: string
  itemId: string
  text: string
  kind?: "line" | "train"
}

// مصادر التقديم: التمرين وبلوكات العمل/الأسرة/الراحة — أما الصلوات والقرآن فلكلٍّ وقته
const EARLY_SRC_SLOTS = WORK_SLOTS

export function earlyMap(events: Ev[], now: string): Map<string, Early[]> {
  const map = new Map<string, Early[]>()
  if (!settings.qada.early) return map
  const cu = currentUnit()
  const sorted = events
    .filter((e) => e.unit === cu && !e.external)
    .sort((a, b) => (a.start < b.start ? -1 : 1))
  // البلوكات المستقبِلة الجارية أو القادمة — كلٌّ يعرض ما بعده مما يمكن تقديمه
  const dests = sorted.filter((e) => WORK_SLOTS().includes(e.slot || "") && e.end > now)
  for (const dest of dests) {
    const list: Early[] = []
    for (const src of sorted) {
      if (src.id === dest.id || src.start < dest.end) continue // اللاحق فقط
      if (!EARLY_SRC_SLOTS().includes(src.slot || "") || src.done || src.slot === "quran") continue
      const marked = new Set(checksFor(src.id))
      for (const item of checkable(src)) {
        if (marked.has(item.id)) continue
        list.push({
          destId: dest.id,
          srcId: src.id,
          srcTitle: src.title,
          srcStart: src.start,
          itemId: item.id,
          text: item.text,
        })
      }
    }
    if (list.length) map.set(dest.id, list)
  }
  return map
}

// هل جلسة تمرين اليوم d مكتملة؟
function sessionCompleteFor(d: string): boolean {
  const p = sessionProgress(d)
  return p.total > 0 && p.done >= p.total
}

// ترحيل التمرين ليوم واحد: أمس تمرين لم يكتمل واليوم «تطوير» ← بلوك الصباح يصير قضاء التمرين
function trainCarry(): { from: string; to: string } | null {
  if (!isClient) return null
  const cu = currentUnit()
  const prevU = addDays(cu, -1)
  if (prevU < SCHEDULE_START) return null
  if (workoutDayType(prevU) === 0 || workoutDayType(cu) !== 0) return null
  if (done[`${prevU}#train`] || sessionCompleteFor(prevU)) return null
  return { from: prevU, to: cu }
}

// ── مهمتا اليوم العائمتان: القرآن والتمرين/التطوير ──
// تظهران في كل بلوك مهام (وأسرة وراحة) — تؤدّيهما في أيّها شئت، ومتى أُنجزت واحدة اختفت من البقية
export type DayTask =
  | { kind: "quran"; srcId: string; lines: { itemId: string; text: string }[] }
  | { kind: "train"; date: string; title: string; done: number; total: number; carried?: boolean }
  | { kind: "dev"; id: string; title: string }

export function dayTasks(events: Ev[], unit: string): DayTask[] {
  const out: DayTask[] = []
  const qEv = events.find((e) => e.unit === unit && e.slot === "quran")
  if (qEv && !qEv.done) {
    const marked = new Set(checksFor(qEv.id)) // بنود القرآن وحدها دون مهامك اليدوية
    const pending = qEv.items
      .filter((i) => i.quran && !marked.has(i.id))
      .map((i) => ({ itemId: i.id, text: i.text }))
    if (pending.length) out.push({ kind: "quran", srcId: qEv.id, lines: pending })
  }
  // تمرين أمس غير المكتمل يُرحَّل يومًا واحدًا فيظهر إلى جانب مهمة اليوم
  const carry = trainCarry()
  if (carry && carry.to === unit && settings.workoutEnabled) {
    const p = sessionProgress(carry.from)
    out.push({
      kind: "train",
      date: carry.from,
      carried: true,
      title: `قضاء ${workoutTitle(carry.from)}`,
      done: p.done,
      total: p.total,
    })
  }
  const id = `${unit}#train`
  if (!done[id] && settings.workoutEnabled) {
    if (workoutDayType(unit) === 0) out.push({ kind: "dev", id, title: settings.workout.offTitle })
    else {
      const p = sessionProgress(unit)
      if (p.total === 0 || p.done < p.total)
        out.push({ kind: "train", date: unit, title: workoutTitle(unit), done: p.done, total: p.total })
    }
  }
  return out
}

// كل أحداث النافذة مع تراكب المهام وحالة الإنجاز، وأحداث Google مدموجة كمهام داخل بلوكاتها
export function allEvents(): Ev[] {
  const pulledEvents = getPulled().events
  const now = nowStamp()
  const out: Ev[] = []
  const byUnit = new Map<string, Ev[]>()
  for (const raw of buildRange(SCHEDULE_START, windowEnd()) as Ev[]) {
    const ev: Ev = { ...raw, items: raw.items.map((i) => ({ ...i })), done: !!done[raw.id] }
    const list = byUnit.get(ev.unit!) || []
    list.push(ev)
    byUnit.set(ev.unit!, list)
  }
  // إزاحة التثبيت: ما فات من السنن لا يُتخطّى، فالصلاة التالية تبدأ من حيث توقّف
  // (ومن أطفأ «الورد في السنن» بقيت سننُه بأسمائها بلا وردٍ ولا إزاحة)
  for (const [unit, evs] of settings.wirdEnabled ? byUnit : []) {
    const st = quranStateFor(unit)
    const seq = wirdSeq()
    const labels = tathbeetLabels(st, seq.length) as string[]
    const shift = computeShift(evs, st, now)
    for (let i = 0; i < seq.length; i++) {
      const [slot, itemId] = seq[i]
      const item = evs.find((e) => e.slot === slot)?.items.find((x) => x.id === itemId)
      if (!item) continue
      const cut = item.text.indexOf(" — ") // ما قبل أول شرطة هو اسم السنّة
      if (cut < 0) continue
      item.text = `${item.text.slice(0, cut + 3)}${labels[shift[i]]}`
      item.pool = tathbeetPoolKey(st, shift[i]) // المجمع يتبع النصف المعروض فعلًا
    }
  }
  // أول بلوك مهام في الوحدة هو وجهة المهام التي لم يُحدَّد لها بلوك
  const cabByUnit = new Map<string, Map<string, Due[]>>()
  for (const [unit, evs] of byUnit) {
    const firstTaskSlot = evs.find((e) => WORK_SLOTS().includes(e.slot || ""))?.slot
    cabByUnit.set(unit, itemsForDay(unit, cab, firstTaskSlot))
  }
  for (const ev of [...byUnit.values()].flat()) {
    // مهامك اليدوية تُلحق ببنود البلوك الثابتة، كلٌّ بمعرّفه فلا ينزاح التأشير بحذف غيره
    if (WORK_SLOTS().includes(ev.slot || ""))
      for (const t of tasksFor(ev.unit!, ev.slot!))
        ev.items.push({ id: `task:${t.id}`, text: t.text, taskId: t.id })
    // مهام الخزانات المستحقّة اليوم — كلٌّ في البلوك الذي اخترتَه لها
    for (const { item, drawer, cabinet, deadline } of cabByUnit.get(ev.unit!)?.get(ev.slot!) || []) {
      const where = [cabinet?.name, drawer?.name].filter(Boolean).join(" › ")
      ev.items.push({
        id: `cab:${item.id}`,
        text: item.title,
        cabItemId: item.id,
        hint: deadline ? `${where} · حتى ${deadline}` : where,
      })
      for (const sub of item.subtasks || [])
        ev.items.push({ id: `cab:${item.id}:${sub.id}`, text: sub.title, cabItemId: item.id, depth: 1 })
    }
    // أحداث Google التي تبدأ داخل هذا البلوك تصير بنودًا فيه (وما خارج هذه البلوكات يُهمل)
    if (GOOGLE_HOST_SLOTS.includes(ev.slot || ""))
      for (const g of pulledEvents
        .filter((g) => g.start >= ev.start && g.start < ev.end)
        .sort((a, b) => (a.start < b.start ? -1 : 1)))
        ev.items.push({
          id: `gcal:${g.id}`,
          text: `${g.title} — ${fmt12Short(g.start.slice(11))} (Google)`,
          external: true,
        })
    if (!ev.done) ev.done = isAutoDone(ev) // بعد اكتمال البنود
    out.push(ev)
  }
  return out
}

export const weekStartOf = (d: string) => addDays(d, -dow(d)) // الأسبوع يبدأ الأحد

// ── الإنجاز ──
export function toggleDone(id: string) {
  if (done[id]) delete done[id]
  else done[id] = true
  save(K.done, done)
  notify()
}
export function checksFor(id: string): string[] {
  return checks[id] || []
}
export function toggleCheck(id: string, itemId: string, asMakeup = false) {
  const set = new Set(checks[id] || [])
  const lk = `${id}:${itemId}`
  if (set.has(itemId)) {
    set.delete(itemId)
    delete late[lk]
  } else {
    set.add(itemId)
    if (asMakeup) late[lk] = true // قضاء: نصف إنجاز
  }
  if (set.size) checks[id] = [...set]
  else delete checks[id]
  save(K.checks, checks)
  save(K.late, late)
  notify()
}

export function isLate(id: string, itemId: string): boolean {
  return !!late[`${id}:${itemId}`]
}

// عدد بنود البلوك المؤدّاة قضاءً
export function lateCount(ev: Ev): number {
  return checkable(ev).filter((i) => isLate(ev.id, i.id)).length
}

// ── أخطاء القرآن: مجمع لكل مكان يُقرأ فيه (تسميع/حفظ-تكرار/تثبيت)، يتتبّع أخطاء الآيات عبر الزمن ──
// أسطر بلوك «قرآن وسنة الضحى» الثابتة بالترتيب: [...quranTaskLines(st), سنة الضحى]
// الفهارس بعد إدراج سطر «بين الأذان والإقامة» في كل صلاة (٧ أغسطس)
// مجمع الأخطاء الذي يخصّ سطرًا معينًا في وصف الحدث، أو null إن كان سطرًا بلا تتبّع (أذان/صلاة/أذكار)
// مجمع السنّة يتبع نصف الحزب المعروض فيها فعلًا بعد الإزاحة، لا موضعها في اليوم
export function mistakePoolFor(ev: Ev, itemId: string): string | null {
  if (ev.external) return null
  return ev.items.find((i) => i.id === itemId)?.pool ?? null
}

export function mistakesFor(poolKey: string): Mistake[] {
  return mistakes[poolKey] || []
}

// ما أنجزته اليوم مما يُقرأ فيه القرآن — لإدخال أخطائه من صفحة الإحصاءات
export type DonePool = { pool: string; text: string; from: string }
export function completedQuranPools(events: Ev[], unit: string): DonePool[] {
  const out: DonePool[] = []
  const seen = new Set<string>()
  for (const ev of events) {
    if (ev.unit !== unit || ev.external) continue
    const marked = new Set(checksFor(ev.id))
    for (const item of ev.items) {
      if (!item.pool || !marked.has(item.id) || seen.has(item.pool)) continue // المُنجَز فقط
      seen.add(item.pool)
      out.push({ pool: item.pool, text: item.text, from: ev.title })
    }
  }
  return out
}

export function addMistake(poolKey: string, ayah: string, word: string) {
  const list = mistakes[poolKey] || []
  list.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ayah: ayah.trim(),
    word: word.trim(),
    addedDate: currentUnit(),
  })
  mistakes[poolKey] = list
  save(K.mistakes, mistakes)
  notify()
}

export function removeMistake(poolKey: string, id: string) {
  const rest = (mistakes[poolKey] || []).filter((m) => m.id !== id)
  if (rest.length) mistakes[poolKey] = rest
  else delete mistakes[poolKey]
  save(K.mistakes, mistakes)
  notify()
}

// أخطاء قديمة (من قبل اليوم) لم تُحذف بعد — تركها عند التأشير يعني نصف إنجاز
export function hasOldMistakes(poolKey: string): boolean {
  const today = currentUnit()
  return (mistakes[poolKey] || []).some((m) => m.addedDate < today)
}

// ── المهام اليدوية: تُضاف في بلوكات العمل والأسرة والراحة (الإضافة الوحيدة المسموحة) ──
export function tasksFor(date: string, slot: string): UserTask[] {
  return tasks[date]?.[slot] || []
}
let taskSeq = 0
export function addTask(date: string, slot: string, text: string) {
  const day = { ...(tasks[date] || {}) }
  const id = `${Date.now().toString(36)}${(taskSeq++).toString(36)}`
  day[slot] = [...(day[slot] || []), { id, text }]
  tasks[date] = day
  save(K.tasks, tasks)
  notify()
}
// حذف مهمة لا يمسّ تأشير بقية البنود: كلٌّ مربوط بمعرّفه
export function removeTask(date: string, slot: string, taskId: string) {
  const day = { ...(tasks[date] || {}) }
  const rest = (day[slot] || []).filter((t) => t.id !== taskId)
  if (rest.length) day[slot] = rest
  else delete day[slot]
  if (Object.keys(day).length) tasks[date] = day
  else delete tasks[date]
  delete late[`${date}#${slot}:task:${taskId}`]
  save(K.tasks, tasks)
  save(K.late, late)
  notify()
}

// ── المزامنة: نفس مفاتيح التخزين تُرفع كصفوف مفتاح/قيمة ──
export type SyncRow = { key: string; value: unknown; updated_at: string }

// المفاتيح التي تُزامَن (الإعدادات والحالة والخزانات) — لا شيء عابر
export const SYNC_KEYS = [
  K.settings,
  K.cabinets,
  K.done,
  K.checks,
  K.late,
  K.tasks,
  K.gym,
  K.food,
  K.mistakes,
]

export function localSnapshot(): SyncRow[] {
  return SYNC_KEYS.filter((k) => localStorage.getItem(k) != null).map((k) => ({
    key: k,
    value: JSON.parse(localStorage.getItem(k)!),
    updated_at: stamps[k] || new Date(0).toISOString(),
  }))
}

// دمج ما جاء من السحابة: يفوز الأحدث لكل مفتاح على حدة
export function applyRemote(rows: SyncRow[]) {
  let changed = false
  for (const r of rows) {
    if (!SYNC_KEYS.includes(r.key)) continue
    const mine = stamps[r.key] || new Date(0).toISOString()
    if (r.updated_at <= mine) continue // نسختي أحدث أو مساوية
    localStorage.setItem(r.key, JSON.stringify(r.value))
    stamps[r.key] = r.updated_at
    changed = true
  }
  if (!changed) return
  localStorage.setItem(STAMP, JSON.stringify(stamps))
  reloadFromStorage()
  notify()
}

// إعادة قراءة كل الحالة من التخزين بعد الدمج
function reloadFromStorage() {
  done = load(K.done, {})
  checks = load(K.checks, {})
  tasks = load(K.tasks, {})
  food = load(K.food, {})
  gym = load(K.gym, {})
  late = load(K.late, {})
  mistakes = load(K.mistakes, {})
  cab = load(K.cabinets, emptyCabinets())
  Object.assign(settings, DEFAULT_SETTINGS, load<Partial<Settings>>(K.settings, {}))
  applyEngineConfig()
  cuCache = { at: "", val: "" }
}

// ── تحرير قالب اليوم ──
// البلوك: نهايتُه مرساة (صلاة/ثلث ليل/مدة ثابتة/نومة توازن)، وبدايتُه نهايةُ سابقه
export type Anchor = {
  prayer?: string
  nightFraction?: number
  lastThirdPrev?: boolean
  clock?: number // دقائق من منتصف الليل
  len?: number
  balance?: { target: number; min: number; max: number; keepAfter: number }
  offset?: number
  next?: boolean // مرساة الغد، بها يدور اليوم على البلوك الذي يختاره صاحبه
}
export type Block = {
  id: string
  title: string
  colorId: number
  end: Anchor
  sleep?: boolean
  transparent?: boolean
  gen?: string // بنود مولّدة (صلاة أو قرآن) — لا تُحذف
  task?: boolean // بلوك مهام: يقبل مهامك اليدوية ويستقبل القضاء والتقديم
  items?: Item[]
}

// ── حراسة القالب ──
// البلوك المرساةُ نهايتُه لا تُزحزحها طولُ ما قبله، فطولٌ زائد يجعل بلوكًا ينتهي
// قبل أن يبدأ. وأخطر من ظهوره أنه يختفي: نومةٌ سالبة تدخل حساب نومة التوازن
// فتنتفخ هذه لتبلغ الهدف، فيرى صاحبها يومًا معقولًا في ظاهره فاسدًا في باطنه.
// فلا يُحفظ قالبٌ لا يصمد في مواسم السنة الأربعة.
const SAMPLE_DAYS = ["2026-01-15", "2026-04-15", "2026-06-21", "2026-09-23", "2026-12-21"]
const BROKEN = "هذه المدة تجعل بلوكًا ينتهي قبل أن يبدأ في بعض أيام السنة — جرّب أقلّ منها."

function templatesSound(t: Record<string, { start: Anchor; blocks: Block[] }>): boolean {
  for (const tpl of Object.values(t)) {
    const rot = rotateTemplate(tpl, settings.dayStart)
    for (const d of SAMPLE_DAYS) if (!isMonotone(d, rot)) return false
  }
  return true
}

// أطول مدة تحتملها صلاةٌ بعينها دون أن ينقلب اليوم — بحثٌ ثنائي، ليُقيَّد بها الإدخال
export function maxPrayerMinutes(id: string, cap = 180): number {
  const base = settings.templates
  const try_ = (v: number) => {
    const t = JSON.parse(JSON.stringify(base))
    for (const tpl of Object.values(t) as { blocks: Block[] }[])
      for (const b of tpl.blocks) {
        const f = durationField(b)
        if (f && b.id === id) b.end[f] = v
      }
    return templatesSound(t)
  }
  if (try_(cap)) return cap
  let lo = 5,
    hi = cap
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (try_(mid)) lo = mid
    else hi = mid
  }
  return lo
}

function editTemplates(fn: (t: Record<string, { start: Anchor; blocks: Block[] }>) => void) {
  const next = JSON.parse(JSON.stringify(settings.templates))
  fn(next)
  saveSettings({ templates: next })
}

// يعيد رسالةً إن كان التعديل يقلب اليوم، ولا يحفظ حينها
export function updateBlock(tplId: string, blockId: string, patch: Partial<Block>): string | null {
  const next = JSON.parse(JSON.stringify(settings.templates))
  const b = next[tplId]?.blocks.find((x: Block) => x.id === blockId)
  if (!b) return null
  Object.assign(b, patch)
  if (!templatesSound(next)) return BROKEN
  saveSettings({ templates: next })
  return null
}

// بلوك جديد يُدرج قبل أوّل بلوك ينتهي بعده، فيبقى الترتيب الزمني سليمًا
// البلوك الجديد يولد بلوك مهام ما لم يكن نومًا — وإلا لم يقبل مهمةً ولا قضاءً،
// وكان يولد أعمى عن ذلك كلّه فلا سبيل إلى إبصاره.
export function addBlock(
  tplId: string,
  title: string,
  end: Anchor,
  flags: { sleep?: boolean; task?: boolean } = {}
): string | null {
  const next = JSON.parse(JSON.stringify(settings.templates))
  const tpl = next[tplId]
  if (!tpl) return null
  const sleep = !!flags.sleep
  const block: Block = {
    id: `b${Date.now().toString(36)}`,
    title,
    colorId: sleep ? 8 : 6,
    end,
    sleep: sleep || undefined,
    task: !sleep && flags.task !== false ? true : undefined,
    items: [],
  }
  const order = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"]
  const rank = (a: Anchor) =>
    a.lastThirdPrev ? -1 : a.clock != null ? -0.5 : a.prayer ? order.indexOf(a.prayer) : a.nightFraction ? 10 : 99
  const at = tpl.blocks.findIndex((b: Block) => rank(b.end) > rank(end))
  if (at < 0) tpl.blocks.push(block)
  else tpl.blocks.splice(at, 0, block)
  if (!templatesSound(next))
    return "هذا البلوك يجعل يومك ينقلب — غيّر وقت نهايته أو موضعه."
  saveSettings({ templates: next })
  return null
}

export function removeBlock(tplId: string, blockId: string) {
  editTemplates((t) => {
    const tpl = t[tplId]
    if (tpl) tpl.blocks = tpl.blocks.filter((b) => b.id !== blockId)
  })
}

// ── مدد الصلاة ──
// بلوك الصلاة ينتهي بإحدى صورتين: مدةٍ ثابتة { len }، أو إزاحةٍ عن صلاته نفسِها
// { prayer: <نفسه>, offset } — والثانية هي التي تجعل الجمعة أطول: بلوكها يبدأ قبل
// الأذان بساعة وينتهي بعده بالمدة، فتزيد الخطبةُ ساعةً بلا إعداد منفصل.
// فمن هنا: الإزاحة عن الصلاة نفسِها = مدتُها، وأيّ صورة أخرى ليست مدةً فلا تُمسّ.
export const PRAYER_BLOCKS = ["fajr", "dhuhr", "asr", "maghrib", "isha"]

// هل هذه المرساة تعبّر عن «مدة» هذا البلوك؟
function durationField(b: Block): "len" | "offset" | null {
  if (!PRAYER_BLOCKS.includes(b.id)) return null
  if (b.end.len != null) return "len"
  if (b.end.prayer === b.id && !b.end.next) return "offset"
  return null
}

export function prayerMinutesOf(
  templates: Record<string, { blocks: Block[] }> = settings.templates
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of PRAYER_BLOCKS) {
    for (const tpl of Object.values(templates)) {
      const b = tpl.blocks.find((x) => x.id === id)
      const f = b && durationField(b)
      if (b && f) {
        out[id] = (f === "len" ? b.end.len : b.end.offset) ?? 0
        break
      }
    }
  }
  return out
}

// رقمٌ واحد يعمّ الصلوات الخمس، أو خريطةٌ لكلٍّ مدتُه.
// يعيد رسالةً إن كانت المدة تفسد اليوم، ولا يحفظ شيئًا حينها.
export function setPrayerMinutes(minutes: number | Record<string, number>): string | null {
  const map = typeof minutes === "number" ? null : minutes
  const next = JSON.parse(JSON.stringify(settings.templates))
  for (const tpl of Object.values(next) as { blocks: Block[] }[])
    for (const b of tpl.blocks) {
      const f = durationField(b)
      if (!f) continue
      const v = map ? map[b.id] : (minutes as number)
      if (v == null || !Number.isFinite(v)) continue
      b.end[f] = Math.max(5, Math.round(v))
    }
  if (!templatesSound(next)) return BROKEN
  saveSettings({ templates: next })
  return null
}

// السنن التي يصلح أن يُوزَّع عليها الورد — تُستخرج من أحداث يومٍ فعليّ لا من قائمة
// مكتوبة، فمن غيّر قالبه أو سمّى صلواته بغير أسمائها وجد سننه كما هي عنده.
export function wirdCandidates(): { slot: string; id: string; title: string }[] {
  const out: { slot: string; id: string; title: string }[] = []
  const unit = currentUnit()
  for (const ev of allEvents()) {
    if (ev.unit !== unit || ev.external) continue
    for (const i of ev.items) {
      if (!/^(sunnah|duha|sunnahBefore|sunnahAfter)$/.test(i.id)) continue
      const cut = i.text.indexOf(" — ")
      out.push({ slot: ev.slot!, id: i.id, title: cut < 0 ? i.text : i.text.slice(0, cut) })
    }
  }
  return out
}

// ── بداية اليوم ──
// اليومُ حلقةٌ: أيّ بلوك صلح أن يفتتحها ما دام سابقُه ينتهي بمرساة مطلقة.
// والقالب لا يُحرَّك عند الاختيار — إنما يُدار عند البناء، فالرجوع بإلغاء الاختيار.
export type StartOption = { id: string; title: string }

export function dayStartOptions(): StartOption[] {
  const seen = new Set<string>()
  const out: StartOption[] = []
  for (const tpl of Object.values(settings.templates))
    for (const o of startCandidates(tpl))
      if (!seen.has(o.id)) {
        seen.add(o.id)
        out.push(o)
      }
  return out
}

// البلوك الذي يفتتح اليوم فعلًا الآن
export function currentDayStart(): { blockId: string; clock: number | null } {
  const first = Object.values(settings.templates)[0]
  const ds = settings.dayStart
  return {
    blockId: ds?.blockId || first?.blocks[0]?.id || "",
    clock: ds?.anchor?.clock ?? null,
  }
}

// يُطبَّق على كل القوالب معًا — ويُرفض ما يقلب يومًا رأسًا على عقب
export function setDayStart(next: { blockId?: string; anchor?: Anchor } | null): string | null {
  const sample = ["2026-01-15", "2026-04-15", "2026-06-21", "2026-09-15", "2026-12-21"]
  for (const tpl of Object.values(settings.templates)) {
    const rot = rotateTemplate(tpl, next)
    for (const d of sample)
      if (!isMonotone(d, rot))
        return "هذه البداية تجعل بعض بلوكاتك تنتهي قبل أن تبدأ في بعض أيام السنة — اختر غيرها."
  }
  saveSettings({ dayStart: next })
  return null
}

// نقلُ بلوكٍ في الترتيب — ويُردّ إن جعل يومًا ينقلب
export function moveBlock(tplId: string, blockId: string, dir: -1 | 1): string | null {
  const next = JSON.parse(JSON.stringify(settings.templates))
  const blocks: Block[] = next[tplId]?.blocks
  if (!blocks) return null
  const i = blocks.findIndex((b) => b.id === blockId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= blocks.length) return null
  ;[blocks[i], blocks[j]] = [blocks[j], blocks[i]]
  if (!templatesSound(next)) return "هذا الترتيب يجعل بلوكًا ينتهي قبل أن يبدأ — مراسي البلوكات لا تقبله."
  saveSettings({ templates: next })
  return null
}

// ── القوالب: إنشاءً ونسخًا وتسميةً وحذفًا ──
// اسمُ القالب صار حقلًا فيه، فكان يُعرض معرّفُه (weekday) لا اسمُه.
export function templateName(id: string): string {
  const t = settings.templates[id] as { name?: string } | undefined
  return t?.name || DEFAULT_TEMPLATE_NAMES[id] || id
}

const DEFAULT_TEMPLATE_NAMES: Record<string, string> = {
  weekday: "أيام العمل",
  friday: "الجمعة",
  saturday: "السبت",
}

export function renameTemplate(id: string, name: string) {
  const next = JSON.parse(JSON.stringify(settings.templates))
  if (!next[id]) return
  next[id].name = name
  saveSettings({ templates: next })
}

// النسخ أولى من الإنشاء من فراغ: يومٌ فارغ لا يصلح جدولًا
export function duplicateTemplate(srcId: string, name: string): string {
  const next = JSON.parse(JSON.stringify(settings.templates))
  let id = "tpl" + (Object.keys(next).length + 1)
  while (next[id]) id += "x"
  next[id] = { ...JSON.parse(JSON.stringify(next[srcId])), name }
  saveSettings({ templates: next })
  return id
}

export function removeTemplate(id: string): string | null {
  const ids = Object.keys(settings.templates)
  if (ids.length <= 1) return "لا بدّ من قالبٍ واحد على الأقل."
  const next = JSON.parse(JSON.stringify(settings.templates))
  delete next[id]
  const fallback = Object.keys(next)[0]
  const plan = settings.weekPlan.map((x) => (x === id ? fallback : x))
  saveSettings({ templates: next, weekPlan: plan })
  return null
}

export function resetTemplates() {
  saveSettings({ templates: DEFAULT_TEMPLATES, weekPlan: DEFAULT_WEEK_PLAN, dayStart: null })
}

// ── الجداول الجاهزة: جدول كامل بضغطة، لمن لا يريد بناء يومه من الصفر ──
// الجاهز يحمل الشكل لا الشخص: يأخذ القوالب والأنظمة، ويترك موقعك وطريقة حسابك
// ويوم بدايتك كما هي — فمواقيتك مواقيتُك وإن كان الجدول جدولَ غيرك.
export type Preset = {
  id: string
  name: string
  desc: string
  includes: string[]
}

export const PRESETS: Preset[] = [
  {
    id: "haitham",
    name: "جدول هيثم",
    desc: "يوم يبدأ بنومة الثلث الأخير وينتهي بالقيام، وبلوكاته متلاصقة بين الصلوات.",
    includes: [
      "قوالب ثلاثة: أيام العمل، والجمعة (بتبكير ساعة)، والسبت",
      "نومة توازن تُبقي مجموع نومك ٦ س ٣٥ د، فإن قصر ليلك طالت وقصر عملك",
      "ورد التثبيت موزَّعًا على السنن الثماني بالترتيب",
      "نظام الحفظ: تسميع جزء، وحفظ ربع، ويوم تكرار",
      "دورة تمرين ثلاثية بالتقدّم المزدوج",
    ],
  },
]

// مدد صلاة جدولٍ جاهز — تُقرأ قبل تحميله لتُملأ بها خانات الإعداد
export function presetPrayerMinutes(id: string): Record<string, number> | null {
  if (id !== "haitham") return null
  return prayerMinutesOf(DEFAULT_TEMPLATES)
}

export function loadPreset(id: string) {
  if (id !== "haitham") return
  const from = settings.startDate // الجاهز يبدأ من يومك أنت لا من يومه
  saveSettings({
    templates: DEFAULT_TEMPLATES,
    weekPlan: DEFAULT_WEEK_PLAN,
    dayStart: null, // الجاهز يبدأ يومه بنومة الثلث الأخير كما كُتب قالبه
    wird: DEFAULT_WIRD,
    quran: { ...DEFAULT_QURAN, date: from },
    workout: { ...DEFAULT_WORKOUT, start: from },
    wirdEnabled: true,
    hifzEnabled: true,
    workoutEnabled: true,
  })
}

export { DEFAULT_TEMPLATES }

// ── «بداية جديدة»: تصفير ما تختاره والبدء من تاريخ جديد ──
// كان هذا يتطلّب تعديل شيفرة ونشرًا في كل مرة — وصار زرًّا.
export type FreshScope = {
  quran?: boolean // يعيد موضع التسميع والحفظ إلى بذرته
  workout?: boolean // يعيد دورة التمرين وأوزانها إلى بدايتها
  cabinets?: boolean // يحذف الخزانات والأدراج والمهام
  history?: boolean // يمسح التأشير والإنجاز وسجل التمرين والتغذية والمهام اليدوية
  mistakes?: boolean // يمسح أخطاء القرآن المتراكمة
}

export function freshStart(date: string, scope: FreshScope) {
  settings.startDate = date
  if (scope.quran) settings.quran = { ...settings.quran, date }
  if (scope.workout) settings.workout = { ...settings.workout, start: date }
  save(K.settings, settings)
  if (scope.history) {
    done = {}
    checks = {}
    late = {}
    gym = {}
    food = {}
    tasks = {}
    for (const k of [K.done, K.checks, K.late, K.gym, K.food, K.tasks]) save(k, {})
  }
  if (scope.mistakes) {
    mistakes = {}
    save(K.mistakes, mistakes)
  }
  if (scope.cabinets) {
    cab = emptyCabinets()
    save(K.cabinets, cab)
  }
  applyEngineConfig()
  cuCache = { at: "", val: "" } // الوحدة الجارية تُحسب من جديد
  notify()
}

// ── الخزانات ──
let uidSeq = 0
const uid = () => `${Date.now().toString(36)}${(uidSeq++).toString(36)}`

export function cabinetsData(): CabData {
  return cab
}

function saveCab() {
  save(K.cabinets, cab)
  notify()
}

export function addCabinet(name: string, patch: Partial<Cabinet> = {}): string {
  const id = uid()
  cab = { ...cab, cabinets: [...cab.cabinets, { ...patch, id, name }] }
  saveCab()
  return id
}

export function addDrawer(cabinetId: string, name: string, patch: Partial<Drawer> = {}): string {
  const id = uid()
  cab = { ...cab, drawers: [...cab.drawers, { ...patch, id, cabinetId, name }] }
  saveCab()
  return id
}

export function addCabItem(drawerId: string, title: string, patch: Partial<CabItem> = {}): string {
  const id = uid()
  const item: CabItem = { from: currentUnit(), repeat: { mode: "once" }, ...patch, id, drawerId, title }
  cab = { ...cab, items: [...cab.items, item] }
  saveCab()
  return id
}

type CabKind = "cabinets" | "drawers" | "items"

export function updateCab(kind: CabKind, id: string, patch: Record<string, unknown>) {
  cab = { ...cab, [kind]: cab[kind].map((x) => (x.id === id ? { ...x, ...patch } : x)) } as CabData
  saveCab()
}

// الحذف يجرّ ما تحته: حذف الخزانة يحذف أدراجها ومهامها
export function removeCab(kind: CabKind, id: string) {
  if (kind === "cabinets") {
    const drawerIds = cab.drawers.filter((d) => d.cabinetId === id).map((d) => d.id)
    cab = {
      cabinets: cab.cabinets.filter((c) => c.id !== id),
      drawers: cab.drawers.filter((d) => d.cabinetId !== id),
      items: cab.items.filter((i) => !drawerIds.includes(i.drawerId)),
    }
  } else if (kind === "drawers") {
    cab = {
      ...cab,
      drawers: cab.drawers.filter((d) => d.id !== id),
      items: cab.items.filter((i) => i.drawerId !== id),
    }
  } else {
    cab = { ...cab, items: cab.items.filter((i) => i.id !== id) }
  }
  saveCab()
}

// «إتمام الهدف»: تختفي المهمة (أو الدرج أو الخزانة بكاملها) من الجدول ويبقى سجلّها
export function completeGoal(kind: CabKind, id: string) {
  updateCab(kind, id, { doneAt: currentUnit() })
}
export function reopenGoal(kind: CabKind, id: string) {
  updateCab(kind, id, { doneAt: undefined })
}

export { repeatLabel }

// بلوكات المهام في وحدةٍ ما — لاختيار مكان مهمة الخزانة
export function taskBlocksOf(events: Ev[], unit: string): { slot: string; title: string; start: string }[] {
  return events
    .filter((e) => e.unit === unit && !e.external && TASK_SLOTS().includes(e.slot || ""))
    .sort((a, b) => (a.start < b.start ? -1 : 1))
    .map((e) => ({ slot: e.slot!, title: e.title, start: e.start }))
}

// ── التغذية ──
export function foodFor(d: string) {
  return food[d] || { kcal: 0, p: 0, c: 0, f: 0 }
}
export function addFood(d: string, add: { kcal?: number; p?: number; c?: number; f?: number }) {
  const cur = foodFor(d)
  // يقبل السالب (عدّادات −/+) ولا ينزل تحت الصفر
  food[d] = {
    kcal: Math.max(0, cur.kcal + (+(add.kcal || 0) || 0)),
    p: Math.max(0, cur.p + (+(add.p || 0) || 0)),
    c: Math.max(0, cur.c + (+(add.c || 0) || 0)),
    f: Math.max(0, cur.f + (+(add.f || 0) || 0)),
  }
  save(K.food, food)
  notify()
}
export function resetFood(d: string) {
  delete food[d]
  save(K.food, food)
  notify()
}

export function saveSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch)
  save(K.settings, settings)
  applyEngineConfig() // تغيّر الموقع أو المحرّكات يعيد حساب الجدول كله
  notify()
}

// ── أحداث Google المسحوبة (عرض فقط) ──
export function getPulled(): { at: number; events: Ev[] } {
  return load(K.pulled, { at: 0, events: [] })
}
export function setPulled(events: Ev[]) {
  save(K.pulled, { at: Date.now(), events })
  notify()
}
