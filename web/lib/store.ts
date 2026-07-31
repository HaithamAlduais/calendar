"use client"

// المخزن — يربط المحرك المُتحقَّق منه بالواجهة، وكل الحالة في localStorage
import { buildRange } from "@/lib/engine/schedule.js"
import { addDays, daysBetween, toIso, arab, dow } from "@/lib/engine/dates.js"
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
  { clientId: "", weight: 70 },
  load<{ clientId: string; weight: number }>(K.settings, { clientId: "", weight: 70 })
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

// ── التقدّم مشروط بالإنجاز الفعلي ──
// الأيام الماضية غير المعلَّمة لا تتقدم (تُعاد مهمتها)، واليوم فصاعدًا يُفترض إنجازه
if (isClient) {
  setQuranCompletion((d: string) => {
    if (d >= todayIso()) return { review: true, hifz: true }
    const dn = !!done[`${d}#quran`]
    const arr = checks[`${d}#quran`] || []
    return { review: dn || arr.includes(0), hifz: dn || arr.includes(1) }
  })
  setWorkoutCompletion((d: string) => {
    if (d >= todayIso()) return true
    return !!done[`${d}#train`] || (checks[`${d}#train`] || []).length > 0
  })
}

// نهاية النافذة: تغطي دومًا كتلة شهر التمرين الجارية كاملة
function windowEnd(): string {
  const off = Math.max(0, daysBetween(BLOCK_START, todayIso()))
  return addDays(BLOCK_START, (Math.floor(off / 28) + 1) * 28 - 1)
}

// كل أحداث النافذة مع تراكب المهام وحالة الإنجاز
export function allEvents(): Ev[] {
  const out: Ev[] = []
  for (const raw of buildRange(SCHEDULE_START, windowEnd()) as Ev[]) {
    const ev: Ev = { ...raw, done: !!done[raw.id] }
    if (ev.slot === "work1" && ev.title === "عمل") {
      const list = tasks[ev.unit!] || []
      ev.desc = list.length ? list.map((t, i) => `${arab(i + 1)}. ${t}`).join("\n") : ""
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
