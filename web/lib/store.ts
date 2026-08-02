"use client"

// المخزن — يربط المحرك المُتحقَّق منه بالواجهة، وكل الحالة في localStorage
import { buildRange } from "@/lib/engine/schedule.js"
import { addDays, daysBetween, toIso, arab, dow } from "@/lib/engine/dates.js"
import { prayerTimes } from "@/lib/engine/prayers.js"
import { setQuranCompletion, clearQuranCache } from "@/lib/engine/quran.js"
import { setWorkoutCompletion, workoutPlan } from "@/lib/engine/workout.js"

export type Ev = {
  id: string
  unit?: string
  slot?: string
  title: string
  start: string // "YYYY-MM-DDTHH:MM" بجدار الرياض
  end: string
  colorId: number
  desc: string
  transparent?: boolean
  done?: boolean
  external?: boolean
  account?: string // بريد حساب Google المصدر (للأحداث الخارجية)
}

export const SCHEDULE_START = "2026-07-31"
const BLOCK_START = "2026-08-01" // كتل شهر التمرين: ٢٨ يومًا (سبت←جمعة ×٤)

const K = {
  done: "hc.done.v1",
  checks: "hc.checks.v1",
  tasks: "hc.tasks.v1",
  food: "hc.food.v1",
  settings: "hc.settings.v2",
  pulled: "hc.pulled.v1",
  lastSeen: "hc.lastseen.v1",
  gym: "hc.gym.v1",
  late: "hc.late.v1",
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
let checks = load<Record<string, number[]>>(K.checks, {})
let tasks = load<Record<string, string[]>>(K.tasks, {})
let food = load<Record<string, { kcal: number; p: number; c: number; f: number }>>(K.food, {})
// سجل التمرين: تاريخ ← مفتاح خلية ("exKey:setIdx" أو "exKey:setIdx:partKey") ← منجَز
let gym = load<Record<string, Record<string, boolean>>>(K.gym, {})
// البنود المؤدّاة قضاءً (خارج وقتها) — نصف إنجاز: "eventId:lineIdx"
let late = load<Record<string, boolean>>(K.late, {})
export const settings = Object.assign(
  { clientId: "", weight: 70, accounts: [] as string[], notify: false, push: false },
  load<{ clientId: string; weight: number; accounts: string[]; notify: boolean; push: boolean }>(
    K.settings,
    { clientId: "", weight: 70, accounts: [], notify: false, push: false }
  )
)

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

// اليوم عند هيثم يبدأ بصلاة الفجر لا بمنتصف الليل:
// قبل فجر اليوم ما زلنا في وحدة الأمس (ليلها)، ومن الفجر تبدأ وحدة اليوم
export function currentUnit(): string {
  const t = todayIso()
  const fajr = prayerTimes(t).fajr as number
  const p = (x: number) => String(x).padStart(2, "0")
  const fajrStamp = `${t}T${p(Math.floor(fajr / 60))}:${p(fajr % 60)}`
  return nowStamp() >= fajrStamp ? t : addDays(t, -1)
}

// ── التقدّم مشروط بالإنجاز الفعلي ──
// الوحدات الماضية (انتهت بمغربها) غير المعلَّمة لا تتقدم، والوحدة الحالية فصاعدًا يُفترض إنجازها
if (isClient) {
  setQuranCompletion((d: string) => {
    if (d >= currentUnit()) return { review: true, hifz: true }
    const dn = !!done[`${d}#quran`]
    const arr = checks[`${d}#quran`] || []
    return { review: dn || arr.includes(0), hifz: dn || arr.includes(1) }
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

// البلوكات التي تستقبل مهام Google: عمل/عائلة (work1-3) والراحة/الزوجة (rest)
const GOOGLE_HOST_SLOTS = ["work1", "work2", "work3", "rest"]
const NUMBERED_RE = /^[٠-٩]+\.\s/

function fmt12Short(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  const ap = h < 12 ? "ص" : "م"
  const h12 = h % 12 || 12
  return m === 0 ? `${arab(h12)} ${ap}` : `${arab(h12)}:${arab(String(m).padStart(2, "0"))} ${ap}`
}

export function numberedIdx(desc?: string): number[] {
  const idx: number[] = []
  ;(desc || "").split("\n").forEach((ln, i) => {
    if (NUMBERED_RE.test(ln)) idx.push(i)
  })
  return idx
}

// إنجاز تلقائي: البلوك يُعدّ منجزًا متى أُنجزت كل بنوده (أو كل جلسات تمرينه)
export function isAutoDone(ev: Ev): boolean {
  if (ev.external) return false
  if (ev.slot === "train") {
    const p = sessionProgress(ev.unit!)
    return p.total > 0 && p.done >= p.total
  }
  const idx = numberedIdx(ev.desc)
  if (!idx.length) return false
  const marked = new Set(checksFor(ev.id))
  return idx.every((i) => marked.has(i))
}

// ── نظام القضاء: البلوك الفائت تنتقل بنوده غير المنجزة إلى بلوك العمل القادم ──
const WORK_SLOTS = ["work1", "work2", "work3"]

export type Makeup = {
  destId: string
  srcId: string
  srcTitle: string
  srcStart: string
  idx: number
  text: string
}

// البلوك فائت: انتهى وقته وفيه بنود لم تُنجز (والتمرين: جلسات ناقصة)
export function isMissed(ev: Ev, now: string): boolean {
  if (ev.external || ev.end > now) return false
  if (ev.slot === "train") {
    const p = sessionProgress(ev.unit!)
    return p.total > 0 && p.done < p.total
  }
  const idx = numberedIdx(ev.desc)
  if (!idx.length) return false
  const marked = new Set(checksFor(ev.id))
  return idx.some((i) => !marked.has(i))
}

// خريطة القضاء: بلوك العمل القادم ← البنود الفائتة المنقولة إليه
// القضاء داخل اليوم الواحد فقط (وحدة فجر←فجر): ما فات يومه لا يُقضى
export function makeupMap(events: Ev[], now: string): Map<string, Makeup[]> {
  const map = new Map<string, Makeup[]>()
  const cu = currentUnit()
  const sorted = events
    .filter((e) => e.unit === cu)
    .sort((a, b) => (a.start < b.start ? -1 : 1))
  // بلوكات العمل/العائلة التي لم ينتهِ وقتها بعد، بالترتيب
  const dests = sorted.filter((e) => !e.external && WORK_SLOTS.includes(e.slot || "") && e.end > now)
  if (!dests.length) return map
  for (const ev of sorted) {
    if (ev.external || ev.end > now || ev.slot === "train") continue
    const idx = numberedIdx(ev.desc)
    if (!idx.length) continue
    const marked = new Set(checksFor(ev.id))
    const pending = idx.filter((i) => !marked.has(i))
    if (!pending.length) continue
    // أول بلوك عمل يبدأ بعد نهاية البلوك الفائت (أو الجاري الآن)
    const dest = dests.find((d) => d.start >= ev.end) || dests[0]
    const lines = (ev.desc || "").split("\n")
    const list = map.get(dest.id) || []
    for (const i of pending)
      list.push({
        destId: dest.id,
        srcId: ev.id,
        srcTitle: ev.title,
        srcStart: ev.start,
        idx: i,
        text: lines[i].replace(NUMBERED_RE, ""),
      })
    map.set(dest.id, list)
  }
  return map
}

// كل أحداث النافذة مع تراكب المهام وحالة الإنجاز، وأحداث Google مدموجة كمهام داخل بلوكاتها
export function allEvents(): Ev[] {
  const pulledEvents = getPulled().events
  const out: Ev[] = []
  for (const raw of buildRange(SCHEDULE_START, windowEnd()) as Ev[]) {
    const ev: Ev = { ...raw, done: !!done[raw.id] }
    if (ev.slot === "work1" && ev.title === "عمل") {
      const list = tasks[ev.unit!] || []
      ev.desc = list.length ? list.map((t, i) => `${arab(i + 1)}. ${t}`).join("\n") : ""
    }
    // أحداث Google التي تبدأ داخل هذا البلوك تصير بنود مهام فيه (وما خارج هذه البلوكات يُهمل)
    if (GOOGLE_HOST_SLOTS.includes(ev.slot || "")) {
      const gs = pulledEvents
        .filter((g) => g.start >= ev.start && g.start < ev.end)
        .sort((a, b) => (a.start < b.start ? -1 : 1))
      if (gs.length) {
        const base = ev.desc ? ev.desc.split("\n") : []
        let n = base.filter((l) => NUMBERED_RE.test(l)).length
        const extra = gs.map(
          (g) => `${arab(++n)}. ${g.title} — ${fmt12Short(g.start.slice(11))} (Google)`
        )
        ev.desc = [...base, ...extra].join("\n")
      }
    }
    if (!ev.done) ev.done = isAutoDone(ev) // بعد اكتمال الوصف النهائي
    out.push(ev)
  }
  return out
}

export const weekStartOf = (d: string) => addDays(d, -((dow(d) - 6 + 7) % 7)) // الأسبوع يبدأ السبت

// ── الإنجاز ──
export function toggleDone(id: string) {
  if (done[id]) delete done[id]
  else done[id] = true
  save(K.done, done)
  notify()
}
export function checksFor(id: string): number[] {
  return checks[id] || []
}
export function toggleCheck(id: string, lineIdx: number, asMakeup = false) {
  const set = new Set(checks[id] || [])
  const lk = `${id}:${lineIdx}`
  if (set.has(lineIdx)) {
    set.delete(lineIdx)
    delete late[lk]
  } else {
    set.add(lineIdx)
    if (asMakeup) late[lk] = true // قضاء: نصف إنجاز
  }
  if (set.size) checks[id] = [...set]
  else delete checks[id]
  save(K.checks, checks)
  save(K.late, late)
  notify()
}

export function isLate(id: string, lineIdx: number): boolean {
  return !!late[`${id}:${lineIdx}`]
}

// عدد بنود البلوك المؤدّاة قضاءً
export function lateCount(ev: Ev): number {
  return numberedIdx(ev.desc).filter((i) => isLate(ev.id, i)).length
}

// ── مهام العمل (الإضافة الوحيدة المسموحة) ──
export function tasksFor(date: string): string[] {
  return tasks[date] || []
}
export function addTask(date: string, text: string) {
  tasks[date] = [...(tasks[date] || []), text]
  save(K.tasks, tasks)
  notify()
}
export function removeTask(date: string, idx: number) {
  tasks[date] = (tasks[date] || []).filter((_, i) => i !== idx)
  if (!tasks[date].length) delete tasks[date]
  delete checks[`${date}#work1`] // الفهارس تغيّرت
  save(K.tasks, tasks)
  save(K.checks, checks)
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

export function saveSettings(patch: Partial<typeof settings>) {
  Object.assign(settings, patch)
  save(K.settings, settings)
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
