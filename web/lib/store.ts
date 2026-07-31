"use client"

// المخزن — يربط المحرك المُتحقَّق منه بالواجهة، وكل الحالة في localStorage
import { buildRange } from "@/lib/engine/schedule.js"
import { addDays, daysBetween, toIso, arab, dow } from "@/lib/engine/dates.js"
import { prayerTimes } from "@/lib/engine/prayers.js"
import { setQuranCompletion, clearQuranCache } from "@/lib/engine/quran.js"
import { setWorkoutCompletion } from "@/lib/engine/workout.js"

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
  setWorkoutCompletion((d: string) => {
    if (d >= currentUnit()) return true
    return !!done[`${d}#train`] || (checks[`${d}#train`] || []).length > 0
  })
}

export function isDone(id: string): boolean {
  return !!done[id]
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
export function toggleCheck(id: string, lineIdx: number) {
  const set = new Set(checks[id] || [])
  if (set.has(lineIdx)) set.delete(lineIdx)
  else set.add(lineIdx)
  if (set.size) checks[id] = [...set]
  else delete checks[id]
  save(K.checks, checks)
  notify()
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
  food[d] = {
    kcal: cur.kcal + (+(add.kcal || 0) || 0),
    p: cur.p + (+(add.p || 0) || 0),
    c: cur.c + (+(add.c || 0) || 0),
    f: cur.f + (+(add.f || 0) || 0),
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
