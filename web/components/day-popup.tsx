"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { CheckCircle2Icon, MoonIcon, XCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { arab } from "@/lib/engine/dates.js"
import { quranStateFor, reviewLine, hifzLine } from "@/lib/engine/quran.js"
import { workoutDayType, workoutTitle } from "@/lib/engine/workout.js"
import { fmtDateLong } from "@/lib/format"
import {
  checksFor,
  isDone,
  markPopupSeen,
  popupUnitIfNew,
  SCHEDULE_START,
  sessionProgress,
  settings,
  subscribe,
} from "@/lib/store"

function StatusRow({ ok, label, note }: { ok: boolean; label: string; note?: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {ok ? (
        <CheckCircle2Icon className="mt-0.5 size-4 flex-none text-emerald-600" />
      ) : (
        <XCircleIcon className="text-destructive mt-0.5 size-4 flex-none" />
      )}
      <div>
        <span className={cn(!ok && "font-medium")}>{label}</span>
        {note && <div className="text-muted-foreground text-xs">{note}</div>}
      </div>
    </div>
  )
}

// نافذة بداية اليوم (تبدأ الوحدة بنومة الثلث الأخير): تقرير الأمس وحال اليوم المبني عليه
export function DayPopup() {
  const [info, setInfo] = useState<{ prev: string; cur: string } | null>(null)
  // تُقرأ عبر الاشتراك حتى تُعاد المحاولة فور فراغه من الإعداد الأول
  const onboarded = useSyncExternalStore(
    subscribe,
    () => settings.onboarded,
    () => true
  )

  useEffect(() => {
    if (onboarded) setInfo(popupUnitIfNew())
  }, [onboarded])

  if (!info || !onboarded) return null
  const { prev, cur } = info
  const first = prev < SCHEDULE_START

  const stCur = quranStateFor(cur)
  const stPrev = quranStateFor(first ? cur : prev)
  const qChecks = checksFor(`${prev}#quran`)
  const qDone = isDone(`${prev}#quran`)
  const reviewDone = qDone || qChecks.includes("review")
  const hifzDone = qDone || qChecks.includes("hifz")
  const prevTrainType = workoutDayType(prev)
  const prevProg = sessionProgress(prev)
  const trainDone =
    isDone(`${prev}#train`) || (prevProg.total > 0 && prevProg.done >= prevProg.total)

  const close = () => {
    markPopupSeen(cur)
    setInfo(null)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MoonIcon className="size-5 text-emerald-600" />
            بدأ يوم {fmtDateLong(cur)}
          </DialogTitle>
          <DialogDescription>هذا حصاد أمس وخطة اليوم.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {!first && (settings.hifzEnabled || settings.workoutEnabled) && (
            <>
              <h3 className="text-sm font-semibold">أمس — {fmtDateLong(prev)}</h3>
              {settings.hifzEnabled && (
                <StatusRow
                  ok={reviewDone}
                  label={`التسميع: الجزء ${arab(stPrev.reviewJuz)}`}
                  note={reviewDone ? undefined : "لم يُنجز — سيُعاد الجزء نفسه اليوم"}
                />
              )}
              {settings.hifzEnabled && (
                <StatusRow
                  ok={hifzDone}
                  label={`الحفظ: ${stPrev.hifzMode} الربع ${arab(stPrev.hifzQuarter)} من الجزء ${arab(stPrev.hifzJuz)}`}
                  note={hifzDone ? undefined : "لم يُنجز — سيُعاد الربع نفسه اليوم"}
                />
              )}
              {settings.workoutEnabled && prevTrainType > 0 && (
                <StatusRow
                  ok={trainDone}
                  label={`التمرين: ${workoutTitle(prev)}${prevProg.total ? ` (${arab(prevProg.done)}/${arab(prevProg.total)} جلسة)` : ""}`}
                  note={
                    trainDone
                      ? undefined
                      : "التمارين غير المكتملة وحدها تجمّد تقدّمها — والمكتملة تتقدّم"
                  }
                />
              )}
              <Separator />
            </>
          )}

          {(settings.hifzEnabled || settings.workoutEnabled) && (
            <>
              <h3 className="text-sm font-semibold">{first ? "خطة أول يوم" : "اليوم بناءً على ذلك"}</h3>
              {settings.hifzEnabled && <p className="text-sm leading-relaxed">• {reviewLine(stCur)}</p>}
              {settings.hifzEnabled && <p className="text-sm leading-relaxed">• {hifzLine(stCur)}</p>}
              {settings.workoutEnabled && <p className="text-sm leading-relaxed">• {workoutTitle(cur)}</p>}
            </>
          )}

          <p className="text-muted-foreground text-[11px] leading-relaxed">
            ما فات وقته اليوم ينتقل تلقائيًا إلى بلوك العمل القادم لتقضيه (نصف إنجاز ½)، وما انقضى
            يومه لا يُقضى.
          </p>
          <Button onClick={close}>بسم الله، توكلنا على الله</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
