"use client"

// الحساب والمزامنة — جدولك على كل أجهزتك.
//
// النموذج بسيط عمدًا: نفس مفاتيح التخزين المحلي (hc.*) تُرفع كصفوف مفتاح/قيمة،
// والدمج آخر-كتابة-تفوز لكل مفتاح على حدة بختم `updated_at`. لا ترجمة ولا مخطّط
// موازٍ — فما يعمل محليًا يعمل مزامَنًا بلا فرع ثانٍ من الشيفرة.
//
// البرنامج يعمل كاملًا بلا حساب (local-first): الحساب يضيف النسخ والمزامنة فقط.
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js"

import { applyRemote, localSnapshot, subscribe, SYNC_KEYS, type SyncRow } from "@/lib/store"

const URL = "https://znlkhlfmhdjmldnmrrym.supabase.co"
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpubGtobGZtaGRqbWxkbm1ycnltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NTI1MzUsImV4cCI6MjA5NDIyODUzNX0.ExdzTK92X6d8YerUwiDk4YQuRgl816uSsbs0ph_3k34"

let client: SupabaseClient | null = null
function sb(): SupabaseClient {
  if (!client) client = createClient(URL, ANON, { auth: { persistSession: true, autoRefreshToken: true } })
  return client
}

let user: User | null = null
let status: "off" | "syncing" | "ok" | "error" = "off"
let lastError = ""
const watchers = new Set<() => void>()
const ping = () => watchers.forEach((f) => f())

export function onSyncChange(fn: () => void) {
  watchers.add(fn)
  return () => watchers.delete(fn)
}
export function syncState() {
  return { user, status, lastError }
}

// ── الدخول ──
export async function sendMagicLink(email: string): Promise<string> {
  const { error } = await sb().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
  })
  return error ? `❌ ${error.message}` : "✅ أرسلنا رابط الدخول إلى بريدك"
}

export async function signInWithGoogle() {
  await sb().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
  })
}

export async function signOut() {
  await sb().auth.signOut()
  user = null
  status = "off"
  ping()
}

// ── الرفع والسحب ──
async function pull() {
  if (!user) return
  const { data, error } = await sb().from("user_state").select("key,value,updated_at")
  if (error) throw error
  applyRemote((data || []) as SyncRow[])
}

async function pushAll() {
  if (!user) return
  const rows = localSnapshot().map((r) => ({ ...r, user_id: user!.id }))
  if (!rows.length) return
  const { error } = await sb().from("user_state").upsert(rows, { onConflict: "user_id,key" })
  if (error) throw error
}

// دفعٌ مؤجَّل: التعديلات المتلاحقة تُجمع في طلب واحد
let timer: ReturnType<typeof setTimeout> | null = null
const dirty = new Set<string>()

async function flush() {
  timer = null
  if (!user || !dirty.size) return
  const keys = [...dirty]
  dirty.clear()
  try {
    status = "syncing"
    ping()
    const rows = localSnapshot()
      .filter((r) => keys.includes(r.key))
      .map((r) => ({ ...r, user_id: user!.id }))
    if (rows.length) {
      const { error } = await sb().from("user_state").upsert(rows, { onConflict: "user_id,key" })
      if (error) throw error
    }
    status = "ok"
    lastError = ""
  } catch (e) {
    status = "error"
    lastError = String(e)
  }
  ping()
}

function queue(keys: string[]) {
  if (!user) return
  for (const k of keys) dirty.add(k)
  if (timer) clearTimeout(timer)
  timer = setTimeout(flush, 1200)
}

// أول إقلاع: استعد الجلسة، اسحب، ادمج، ثم ارفع ما استجدّ محليًا
export async function initSync() {
  if (typeof window === "undefined") return
  const { data } = await sb().auth.getSession()
  user = data.session?.user ?? null
  sb().auth.onAuthStateChange(async (_e, session) => {
    const was = user?.id
    user = session?.user ?? null
    ping()
    if (user && user.id !== was) await firstSync()
  })
  if (user) await firstSync()
  // كل تغيير محلي يُدفع بعد لحظة
  subscribe(() => queue(SYNC_KEYS))
}

async function firstSync() {
  try {
    status = "syncing"
    ping()
    await pull()
    await pushAll()
    status = "ok"
    lastError = ""
  } catch (e) {
    status = "error"
    lastError = String(e)
  }
  ping()
}

export async function syncNow() {
  if (!user) return
  await firstSync()
}
