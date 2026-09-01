"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { BellIcon, CheckIcon, CloudIcon, LogOutIcon, PlusIcon, RefreshCwIcon, RotateCcwIcon, XIcon } from "lucide-react"

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
import {
  BodySection,
  LocationSection,
  QuranSection,
  Section,
  WirdSection,
  WorkoutSection,
} from "@/components/systems-sections"
import { cn } from "@/lib/utils"
import { addAccount, dropToken, pullAccount } from "@/lib/gcal"
import { notificationsGranted, requestNotifications, scheduleNotifications } from "@/lib/notify"
import { disablePush, enablePush, pushSupported } from "@/lib/push"
import { onSyncChange, sendMagicLink, signInWithGoogle, signOut, syncNow, syncState } from "@/lib/sync"
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

// مفتاحٌ بشرحه — الشرح تحت العنوان لا في تلميح، فالإعداد الذي لا يُفهم لا يُستعمل
function Toggle({
  on,
  onClick,
  label,
  help,
}: {
  on: boolean
  onClick: () => void
  label: string
  help: string
}) {
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
        <span className="text-xs font-medium">{label}</span>
        <span className="text-muted-foreground block text-[11px] leading-relaxed">{help}</span>
      </span>
    </button>
  )
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [clientId, setClientId] = useState(settings.clientId)
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  // «بداية جديدة»: تاريخ ونطاق — كان تعديل شيفرة، وصار زرًّا
  const [freshDate, setFreshDate] = useState(todayIso())
  const [scope, setScope] = useState({
    quran: true,
    workout: true,
    history: true,
    cabinets: false,
    mistakes: false,
    templates: false,
    setup: false,
  })
  const [confirming, setConfirming] = useState(false)
  const [email, setEmail] = useState("")
  // حالة الحساب والمزامنة
  useSyncExternalStore(onSyncChange, () => JSON.stringify(syncState()), () => "{}")
  const sync = syncState()

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
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>الإعدادات</DialogTitle>
          <DialogDescription>
            موقعك وأنظمتك وحسابك — كل قسم مطويّ حتى تفتحه، فلا يزاحمك ما لا تحتاجه.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <LocationSection />
          <QuranSection />
          <WirdSection />
          <WorkoutSection />
          <BodySection />

          <Section
            title="حسابات Google Calendar"
            help="أحداث Google تُعرض شفافةً داخل بلوكاتها ولا أثر لها في جدولك: لا تزيح بلوكًا ولا تُحتسب في إنجازك. وهي قراءةٌ فقط — لا يكتب البرنامج في تقويمك شيئًا."
          >
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-xs">Google Client ID</span>
            <Help text="معرّفٌ تأخذه من Google Cloud Console: أنشئ مشروعًا، ثم OAuth client ID من نوع Web، وأضف عنوان هذا الموقع في Authorized JavaScript origins. وهو لعرض أحداث تقويمك فقط — ولستَ محتاجًا إليه إن لم ترد ذلك." />
          </div>
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
          </Section>

          <div className="border-t pt-3">
            <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">
              الحساب والمزامنة
              <Help text="البرنامج يعمل كاملًا بلا حساب، وكل شيء محفوظ في جهازك. الحساب يضيف شيئين: جدولك على كل أجهزتك، ونسخة احتياطية لا تضيع بمسح بيانات المتصفح." />
            </h3>
            {sync.user ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs">
                  متّصل بـ <span className="font-medium">{sync.user.email}</span>
                  <span className="text-muted-foreground">
                    {sync.status === "syncing" ? " — جارٍ المزامنة…" : sync.status === "ok" ? " — مُزامَن ✅" : sync.status === "error" ? " — تعذّرت المزامنة" : ""}
                  </span>
                </p>
                {sync.status === "error" && (
                  <p className="text-destructive text-[11px] leading-relaxed">{sync.lastError}</p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => syncNow()}>
                    <RefreshCwIcon />
                    زامن الآن
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => signOut()}>
                    <LogOutIcon />
                    خروج
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  ادخل ليصير جدولك على كل أجهزتك — وبلا حساب يبقى كل شيء في هذا الجهاز وحده.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="بريدك…"
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    disabled={!email.includes("@")}
                    onClick={async () => setStatus(await sendMagicLink(email))}
                  >
                    <CloudIcon />
                    رابط الدخول
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={() => signInWithGoogle()}>
                  الدخول بحساب Google
                </Button>
              </div>
            )}
          </div>

          {/* الصيام */}
          <div className="border-t pt-3">
            <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">
              صيام الاثنين والخميس
              <Help text="في يومي الصيام تسقط وجبات النهار المعلَّمة «صيام» من جدولك تلقائيًّا — علِّمها من محرر بنود البلوك." />
            </h3>
            <Toggle
              on={settings.fasting}
              onClick={() => saveSettings({ fasting: !settings.fasting })}
              label="أصوم الاثنين والخميس"
              help="سنّةٌ عن النبي ﷺ — والوجبة المعلَّمة تسقط في يوميها."
            />
          </div>

          {/* القضاء والتقديم */}
          <div className="border-t pt-3">
            <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">
              القضاء والتقديم
              <Help text="ما فات وقته لا يسقط ولا يُنقل: يبقى في بلوكه فتؤشّره فيه — لكن بنصف إنجاز، لأن الوقت جزءٌ من العمل. وعكسه التقديم: تؤدي مهمة بلوكٍ لاحق في بلوك سابق من يومك، فتُحتسب كاملة إذ أدّيتها في يومها." />
            </h3>
            <div className="flex flex-col gap-2">
              <Toggle
                on={settings.qada.enabled}
                onClick={() => saveSettings({ qada: { ...settings.qada, enabled: !settings.qada.enabled } })}
                label="قضاء ما فات"
                help="إن أطفأته، فالبلوك الذي انتهى وقته يُغلق بما فيه فلا تُؤشَّر بنودُه بعد وقتها."
              />
              {settings.qada.enabled && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">حظّ المقضيّ من الإنجاز</span>
                    <Help text="البند المقضيّ يُحتسب بهذا الحظّ في نسبة يومك. والنصف هو الأصل: أدّيتَه، لكن لا في وقته." />
                    <div className="flex flex-wrap gap-1">
                      {[0.25, 0.5, 0.75, 1].map((c) => (
                        <button
                          key={c}
                          onClick={() => saveSettings({ qada: { ...settings.qada, credit: c } })}
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-xs transition-colors",
                            settings.qada.credit === c
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:bg-muted"
                          )}
                        >
                          {c === 1 ? "كامل" : c === 0.5 ? "نصف" : c === 0.25 ? "ربع" : "ثلاثة أرباع"}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <Toggle
                on={settings.qada.early}
                onClick={() => saveSettings({ qada: { ...settings.qada, early: !settings.qada.early } })}
                label="التقديم"
                help="يعرض لك في بلوكك الحالي مهامَّ بلوكاتك اللاحقة من يومك، فتؤدّيها الآن بإنجاز كامل."
              />
            </div>
          </div>

          <div className="border-t pt-3">
            <h3 className="mb-2 text-sm font-semibold">تنبيهات البلوكات</h3>
            <p className="text-muted-foreground mb-2 text-xs">
              تنبيهان لكل بلوك: قبله بثلاثين دقيقة وعند بدئه — من خادمنا مباشرة، فتصل هاتفك حتى
              والتطبيق مغلق تمامًا.
            </p>
            {!sync.user && (
              <p className="text-muted-foreground mb-2 text-[11px] leading-relaxed">
                وبلا حساب يحسبها الخادم على الجدول الافتراضي، فإعداداتك في جهازك وحده لا يبلغها.
                ادخل بحسابك ليحسبها على قوالبك وموقعك أنت.
              </p>
            )}
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
                ["templates", "قوالب أيامك — ترجع إلى الأصل بخطة أسبوعك وبداية يومك"],
                ["setup", "الإعداد الأول — يُعرض من جديد فتختار موقعك وجدولك"],
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
