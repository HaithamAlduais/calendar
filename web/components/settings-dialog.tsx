"use client"

import { useState } from "react"
import { BellIcon, PlusIcon, RefreshCwIcon, RotateCcwIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Help } from "@/components/help"
import { cn } from "@/lib/utils"
import { addAccount, dropToken, pullAccount } from "@/lib/gcal"
import { notificationsGranted, requestNotifications, scheduleNotifications } from "@/lib/notify"
import { disablePush, enablePush, pushSupported } from "@/lib/push"
import { addDays, arab } from "@/lib/engine/dates.js"
import { dotColor } from "@/lib/format"
import {
  allEvents,
  currentUnit,
  freshStart,
  getPulled,
  saveSettings,
  setPulled,
  settings,
  todayIso,
  weekStartOf,
} from "@/lib/store"

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [clientId, setClientId] = useState(settings.clientId)
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  // «بداية جديدة»: تاريخ ونطاق — كان تعديل شيفرة، وصار زرًّا
  const [freshDate, setFreshDate] = useState(todayIso())
  const [scope, setScope] = useState({ quran: true, workout: true, history: true, cabinets: false, mistakes: false })
  const [confirming, setConfirming] = useState(false)

  const ensureClientId = (): string | null => {
    const cid = clientId.trim()
    if (!cid) {
      setStatus("⚠️ الصق الـ Client ID أولًا")
      return null
    }
    if (cid !== settings.clientId) saveSettings({ clientId: cid })
    return cid
  }

  const refreshAll = async (cid: string, accounts: string[]) => {
    const ws = weekStartOf(todayIso())
    const from = addDays(ws, -7)
    const to = addDays(ws, 27)
    const all = []
    for (let i = 0; i < accounts.length; i++) {
      setStatus(`جارٍ الجلب من ${accounts[i]}…`)
      all.push(...(await pullAccount(cid, accounts[i], i, from, to)))
    }
    setPulled(all)
    setStatus(`✅ ${arab(all.length)} حدثًا من ${arab(accounts.length)} حساب`)
  }

  const onAddAccount = async () => {
    const cid = ensureClientId()
    if (!cid) return
    setBusy(true)
    try {
      setStatus("اختر الحساب من نافذة Google…")
      const email = await addAccount(cid)
      const accounts = settings.accounts.includes(email)
        ? settings.accounts
        : [...settings.accounts, email]
      saveSettings({ accounts })
      await refreshAll(cid, accounts)
    } catch (e) {
      setStatus(`❌ ${e instanceof Error ? e.message : "خطأ"}`)
    } finally {
      setBusy(false)
    }
  }

  const onRefresh = async () => {
    const cid = ensureClientId()
    if (!cid) return
    if (!settings.accounts.length) return setStatus("أضف حسابًا أولًا")
    setBusy(true)
    try {
      await refreshAll(cid, settings.accounts)
    } catch (e) {
      setStatus(`❌ ${e instanceof Error ? e.message : "خطأ"}`)
    } finally {
      setBusy(false)
    }
  }

  const onRemove = (email: string) => {
    dropToken(email)
    saveSettings({ accounts: settings.accounts.filter((a) => a !== email) })
    setPulled(getPulled().events.filter((e) => e.account !== email))
    setStatus(`أُزيل ${email}`)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>حسابات Google Calendar</DialogTitle>
          <DialogDescription>
            أضف حسابًا أو أكثر — شاشة Google ستعرض كل الحسابات المسجلة على جهازك لتختار منها.
            أحداث Google تُدمج كمهام قابلة للتأشير داخل بلوكات العمل والعائلة والراحة حسب وقتها
            (قراءة فقط).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input
            dir="ltr"
            placeholder="xxxxx.apps.googleusercontent.com"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />

          {settings.accounts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {settings.accounts.map((email, i) => (
                <div key={email} className="bg-muted flex items-center gap-2 rounded-md p-2 text-sm">
                  <span className={cn("size-2.5 flex-none rounded-full", dotColor([7, 3, 5, 4][i % 4], false))} />
                  <span dir="ltr" className="truncate">{email}</span>
                  <button
                    onClick={() => onRemove(email)}
                    className="text-muted-foreground hover:text-destructive ms-auto"
                    aria-label={`إزالة ${email}`}
                  >
                    <XIcon className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {status && <p className="text-muted-foreground text-xs">{status}</p>}

          <div className="flex gap-2">
            <Button className="flex-1" onClick={onAddAccount} disabled={busy}>
              <PlusIcon />
              إضافة حساب
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              onClick={onRefresh}
              disabled={busy || !settings.accounts.length}
            >
              <RefreshCwIcon className={cn(busy && "animate-spin")} />
              تحديث الكل
            </Button>
          </div>
          {getPulled().events.length > 0 && (
            <Badge variant="secondary" className="self-start">
              {arab(getPulled().events.length)} حدث Google معروض حاليًا
            </Badge>
          )}

          <div className="border-t pt-3">
            <h3 className="mb-2 text-sm font-semibold">تنبيهات البلوكات</h3>
            <p className="text-muted-foreground mb-2 text-xs">
              تنبيهان لكل بلوك: قبله بثلاثين دقيقة وعند بدئه — من خادمنا مباشرة، فتصل هاتفك حتى
              والتطبيق مغلق تمامًا.
            </p>
            <Button
              variant={settings.notify && notificationsGranted() ? "secondary" : "default"}
              className="w-full"
              disabled={busy}
              onClick={async () => {
                if (settings.notify && notificationsGranted()) {
                  setBusy(true)
                  await disablePush()
                  saveSettings({ notify: false, push: false })
                  scheduleNotifications([])
                  setBusy(false)
                  setStatus("🔕 أُوقفت التنبيهات")
                  return
                }
                const ok = await requestNotifications()
                if (!ok) return setStatus("❌ رُفض إذن التنبيهات — فعّله من إعدادات المتصفح للموقع")
                setBusy(true)
                const serverPush = pushSupported() && (await enablePush())
                setBusy(false)
                if (serverPush) {
                  saveSettings({ notify: true, push: true })
                  scheduleNotifications([])
                  setStatus("🔔 فُعّلت الإشعارات المضمونة — تصل حتى والتطبيق مغلق ✅")
                } else {
                  saveSettings({ notify: true, push: false })
                  const n = scheduleNotifications(allEvents())
                  setStatus(`🔔 فُعّلت محليًا (جُدول ${arab(n)}) — الخادم غير متاح الآن`)
                }
              }}
            >
              <BellIcon />
              {settings.notify && notificationsGranted() ? "إيقاف التنبيهات" : "تفعيل التنبيهات"}
            </Button>
          </div>

          <div className="border-t pt-3">
            <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">
              بداية جديدة
              <Help text="تبدأ من تاريخٍ تختاره: يعود القرآن إلى موضع بذرته، والتمرين إلى أول دورته، ويُمسح ما تختاره من سجلّك. وما قبل ذلك التاريخ لا يظهر في الجدول." />
            </h3>
            <p className="text-muted-foreground mb-2 text-xs leading-relaxed">
              فرصة جديدة: اختر يومًا تبدأ منه، وحدّد ما تريد تصفيره.
            </p>
            <div className="mb-2 flex items-center gap-2">
              <label className="text-muted-foreground flex-none text-xs">من يوم</label>
              <Input type="date" value={freshDate} onChange={(e) => setFreshDate(e.target.value)} className="h-8" />
            </div>
            <div className="mb-2 flex flex-col gap-1">
              {([
                ["quran", "القرآن — يعود إلى موضع البذرة"],
                ["workout", "التمرين — يعود إلى أول الدورة وأوزانها"],
                ["history", "السجل — التأشير والإنجاز والتغذية والمهام اليدوية"],
                ["cabinets", "الخزانات — تُحذف بأدراجها ومهامها"],
                ["mistakes", "أخطاء القرآن المتراكمة"],
              ] as [keyof typeof scope, string][]).map(([k, label]) => (
                <label key={k} className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md p-1 text-xs">
                  <Checkbox
                    checked={scope[k]}
                    onCheckedChange={() => setScope((p) => ({ ...p, [k]: !p[k] }))}
                  />
                  {label}
                </label>
              ))}
            </div>
            {!confirming ? (
              <Button variant="outline" className="w-full" onClick={() => setConfirming(true)}>
                <RotateCcwIcon />
                ابدأ من جديد…
              </Button>
            ) : (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2">
                <p className="mb-2 text-xs leading-relaxed">
                  ستبدأ من {freshDate}، وما اخترته سيُمسح ولا يُسترجع. متأكد؟
                </p>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      freshStart(freshDate, scope)
                      setConfirming(false)
                      setStatus(`✅ بدأنا من جديد — أول يوم ${freshDate}`)
                    }}
                  >
                    نعم، ابدأ
                  </Button>
                  <Button variant="ghost" className="flex-1" onClick={() => setConfirming(false)}>
                    تراجع
                  </Button>
                </div>
              </div>
            )}
            <p className="text-muted-foreground pt-1 text-[11px]">
              أول يوم في جدولك الآن: {currentUnit()}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
