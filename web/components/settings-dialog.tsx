"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { connect, isConnected, pullEvents } from "@/lib/gcal"
import { arab, addDays } from "@/lib/engine/dates.js"
import { saveSettings, setPulled, settings, todayIso, weekStartOf } from "@/lib/store"

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [clientId, setClientId] = useState(settings.clientId)
  const [status, setStatus] = useState(isConnected() ? "✅ متصل بحساب Google" : "غير متصل")
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    const cid = clientId.trim()
    if (!cid) return setStatus("⚠️ الصق الـ Client ID أولًا")
    if (cid !== settings.clientId) saveSettings({ clientId: cid })
    setBusy(true)
    try {
      if (!isConnected()) {
        setStatus("جارٍ فتح نافذة تسجيل الدخول…")
        await connect(cid)
      }
      setStatus("جارٍ سحب أحداث Google…")
      const ws = weekStartOf(todayIso())
      const events = await pullEvents(addDays(ws, -7), addDays(ws, 27))
      setPulled(events)
      setStatus(`✅ ظهر ${arab(events.length)} حدثًا من Google في تقويمك`)
    } catch (e) {
      setStatus(`❌ ${e instanceof Error ? e.message : "خطأ"}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>أحداث Google Calendar</DialogTitle>
          <DialogDescription>
            اربط حسابك لعرض أحداث Google داخل أسبوعك (عرض فقط). تحتاج مرة واحدة إلى OAuth Client
            ID من Google Cloud Console مضافًا فيه أصل هذا الموقع ضمن Authorized JavaScript
            origins.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input
            dir="ltr"
            placeholder="xxxxx.apps.googleusercontent.com"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">{status}</p>
          <Button onClick={refresh} disabled={busy}>
            اتصال وسحب الأحداث
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
