"use client"

// المخزن — يربط المحرك المُتحقَّق منه بالواجهة، وكل الحالة في localStorage
import { buildRange, unitStart } from "@/lib/engine/schedule.js"
import { addDays, daysBetween, toIso, arab, dow } from "@/lib/engine/dates.js"
import { setPrayerConfig } from "@/lib/engine/prayers.js"
import {
  setQuranCompletion,
  clearQuranCache,
  quranStateFor,
  quranTaskLines,
  tathbeetLabels,
  tathbeetPoolKey,
} from "@/lib/engine/quran.js"
import { setWorkoutCompletion, workoutPlan, workoutDayType, workoutTitle } from "@/lib/engine/workout.js"

// بند داخل بلوك: معرّفه ثابت، فالتأشير والقضاء والتقديم تُمسك به لا بموضع السطر
export type Item = {
  id: string
  text: string
  note?: boolean // سطر شرح لا يُؤشَّر
  pool?: string // مجمع أخطاء القرآن
  quran?: boolean // بند من بنود القرآن (مهمة يومية عائمة)
  taskId?: string // مهمة يدوية أضافها المستخدم
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

export const SCHEDULE_START = "2026-08-24" // بداية جديدة (الاثنين ٢٤ أغسطس) — نسينا ما قبلها
const BLOCK_START = "2026-08-24" // نافذة التوليد: كتل ٢٨ يومًا من البداية الجديدة

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
function save(key: string, val: unknown) {
  if (isClient) localStorage.setItem(key, JSON.stringify(val))
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
}
export type Settings = typeof DEFAULT_SETTINGS
export const settings: Settings = Object.assign(
  {} as Settings,
  DEFAULT_SETTINGS,
  load<Partial<Settings>>(K.settings, {})
)

// المحرك يقرأ الموقع من هنا، فيُطبَّق عند الإقلاع وعند كل حفظ
function applyPrayerConfig() {
  const { lat, lng, tz, method, asrFactor } = settings
  setPrayerConfig({ lat, lng, tz, method, asrFactor })
}
applyPrayerConfig()

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
// ترتيب السنن زمنيًا: [slot الحدث، معرّف البند] — لا يتأثر بتغيّر ترتيب البنود
const TATHBEET_SEQ: [string, string][] = [
  ["fajr", "sunnah"],
  ["fajr", "duha"], // سنة الضحى داخل بلوك الفجر
  ["dhuhr", "sunnahBefore"],
  ["dhuhr", "sunnahAfter"],
  ["asr", "sunnah"],
  ["maghrib", "sunnah"],
  ["isha", "sunnahBefore"],
  ["isha", "sunnahAfter"],
]



// نصف الحزب المعروض في السنّة i = i − (عدد السنن الفائتة قبلها)
// فما فات لا يُتخطّى: الصلاة التالية تبدأ من حيث توقّف
function computeShift(unitEvents: Ev[], st: { hifzMode: string }, now: string): number[] {
  const out: number[] = []
  let missed = 0
  for (let i = 0; i < 8; i++) {
    out[i] = i - missed
    const [slot] = TATHBEET_SEQ[i]
    const ev = unitEvents.find((e) => e.slot === slot)
    if (!ev) continue
    const itemId = TATHBEET_SEQ[i][1]
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
// المستقبِلات بالترتيب الزمني: بلوكات العمل/الأسرة ثم أسرة الليل وراحته — والنوم لا يستقبل شيئًا
const WORK_SLOTS = ["quran", "work1", "work2", "work3", "family", "rest"]
// البلوكات التي تقبل مهامك اليدوية — عمل وأسرة وراحة
export const TASK_SLOTS = WORK_SLOTS

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
  const cu = currentUnit()
  const sorted = events
    .filter((e) => e.unit === cu)
    .sort((a, b) => (a.start < b.start ? -1 : 1))
  // البلوكات المستقبِلة التي لم ينتهِ وقتها بعد، بالترتيب
  const dests = sorted.filter((e) => !e.external && WORK_SLOTS.includes(e.slot || "") && e.end > now)
  if (!dests.length) return map
  const push = (destId: string, m: Makeup) => {
    const list = map.get(destId) || []
    list.push(m)
    map.set(destId, list)
  }

  // ── تعويض الأمس: بنود أمس غير المنجزة تُوزَّع بالتناوب على بلوكات اليوم المستقبِلة
  //    (راحة ← عمل/أسرة ← زوجة…) واحدًا تلو الآخر — يوم واحد فقط ──
  const prevU = addDays(cu, -1)
  if (prevU >= SCHEDULE_START) {
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
  const cu = currentUnit()
  const sorted = events
    .filter((e) => e.unit === cu && !e.external)
    .sort((a, b) => (a.start < b.start ? -1 : 1))
  // البلوكات المستقبِلة الجارية أو القادمة — كلٌّ يعرض ما بعده مما يمكن تقديمه
  const dests = sorted.filter((e) => WORK_SLOTS.includes(e.slot || "") && e.end > now)
  for (const dest of dests) {
    const list: Early[] = []
    for (const src of sorted) {
      if (src.id === dest.id || src.start < dest.end) continue // اللاحق فقط
      if (!EARLY_SRC_SLOTS.includes(src.slot || "") || src.done || src.slot === "quran") continue
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
  if (carry && carry.to === unit) {
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
  if (!done[id]) {
    if (workoutDayType(unit) === 0) out.push({ kind: "dev", id, title: "تطوير" })
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
  for (const [unit, evs] of byUnit) {
    const st = quranStateFor(unit)
    const labels = tathbeetLabels(st) as string[]
    const shift = computeShift(evs, st, now)
    for (let i = 0; i < 8; i++) {
      const [slot, itemId] = TATHBEET_SEQ[i]
      const item = evs.find((e) => e.slot === slot)?.items.find((x) => x.id === itemId)
      if (!item) continue
      const cut = item.text.indexOf(" — ") // ما قبل أول شرطة هو اسم السنّة
      if (cut < 0) continue
      item.text = `${item.text.slice(0, cut + 3)}${labels[shift[i]]}`
      item.pool = tathbeetPoolKey(st, shift[i]) // المجمع يتبع النصف المعروض فعلًا
    }
  }
  for (const ev of [...byUnit.values()].flat()) {
    // مهامك اليدوية تُلحق ببنود البلوك الثابتة، كلٌّ بمعرّفه فلا ينزاح التأشير بحذف غيره
    if (WORK_SLOTS.includes(ev.slot || ""))
      for (const t of tasksFor(ev.unit!, ev.slot!))
        ev.items.push({ id: `task:${t.id}`, text: t.text, taskId: t.id })
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
  applyPrayerConfig() // تغيّر الموقع أو الطريقة يعيد حساب الجدول كله
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
