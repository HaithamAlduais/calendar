"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import {
  ActivityIcon,
  CalendarSyncIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { DayPanel } from "@/components/day-panel"
import { DayPopup } from "@/components/day-popup"
import { EventSheet } from "@/components/event-sheet"
import { SettingsDialog } from "@/components/settings-dialog"
import { WeekView } from "@/components/week-view"
import { scheduleNotifications } from "@/lib/notify"
import { addDays, arab, parseIso, MONTH_NAMES } from "@/lib/engine/dates.js"
import {
  allEvents,
  getVersion,
  settings,
  subscribe,
  todayIso,
  weekStartOf,
  type Ev,
} from "@/lib/store"

function weekLabel(ws: string): string {
  const a = parseIso(ws)
  const b = parseIso(addDays(ws, 6))
  return a.m === b.m
    ? `${MONTH_NAMES[a.m - 1]} ${arab(a.y)}`
    : `${MONTH_NAMES[a.m - 1]} – ${MONTH_NAMES[b.m - 1]} ${arab(b.y)}`
}

export default function Page() {
  const [mounted, setMounted] = useState(false)
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayIso()))
  const [openEv, setOpenEv] = useState<Ev | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const version = useSyncExternalStore(subscribe, getVersion, () => 0)

  useEffect(() => setMounted(true), [])

  // نبضة كل دقيقة: تحديث «الآن» وحالة البلوكات الفائتة
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000)
    return () => clearInterval(t)
  }, [])

  // أحداث Google مدموجة داخل بلوكاتها في allEvents — لا بطاقات مستقلة لها
  const events = useMemo(() => {
    if (!mounted) return []
    return allEvents()
  }, [mounted, version])

  // الحدث المفتوح يُقرأ حيًّا من القائمة المُحدَّثة حتى تظهر المهام والتعديلات فورًا
  const liveOpenEv = openEv ? (events.find((e) => e.id === openEv.id) ?? openEv) : null

  // الجدولة المحلية احتياط فقط عندما لا يعمل دفع الخادم (الخادم يرسل حتى والتطبيق مغلق)
  useEffect(() => {
    if (!mounted || !settings.notify || settings.push) return
    scheduleNotifications(events)
    const onVis = () => {
      if (document.visibilityState === "visible" && settings.notify && !settings.push)
        scheduleNotifications(allEvents())
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [mounted, events])

  if (!mounted) {
    return (
      <div className="text-muted-foreground flex h-dvh items-center justify-center text-sm">
        جارٍ تجهيز أسبوعك…
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-1 border-b px-3 py-2">
        <h1 className="text-base font-bold">تقويم هيثم</h1>
        <span className="text-muted-foreground ms-2 hidden text-sm sm:inline">
          {weekLabel(weekStart)}
        </span>
        <div className="ms-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(weekStartOf(todayIso()))}>
            اليوم
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="الأسبوع السابق"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="الأسبوع التالي"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="لوحة اليوم"
            onClick={() => setPanelOpen(true)}
          >
            <ActivityIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="أحداث Google"
            onClick={() => setSettingsOpen(true)}
          >
            <CalendarSyncIcon />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <WeekView weekStart={weekStart} events={events} onOpen={setOpenEv} />
      </main>

      <EventSheet ev={liveOpenEv} events={events} onClose={() => setOpenEv(null)} />
      <DayPanel open={panelOpen} onClose={() => setPanelOpen(false)} events={events} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <DayPopup />
    </div>
  )
}
