"use client"

import { useState } from "react"
import { CheckIcon, MapPinIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Help } from "@/components/help"
import { arab } from "@/lib/format"
import { saveSettings, setPrayerMinutes, settings } from "@/lib/store"

// مدن جاهزة تختصر إدخال الإحداثيات — ولمن ليس فيها زرّ «موقعي» أو إدخال يدوي
const CITIES = [
  { name: "الرياض", lat: 24.7136, lng: 46.6753, tz: 3, method: "ummAlQura" },
  { name: "مكة المكرمة", lat: 21.3891, lng: 39.8579, tz: 3, method: "ummAlQura" },
  { name: "المدينة المنورة", lat: 24.5247, lng: 39.5692, tz: 3, method: "ummAlQura" },
  { name: "جدة", lat: 21.4858, lng: 39.1925, tz: 3, method: "ummAlQura" },
  { name: "الدمام", lat: 26.4207, lng: 50.0888, tz: 3, method: "ummAlQura" },
  { name: "القاهرة", lat: 30.0444, lng: 31.2357, tz: 2, method: "egypt" },
  { name: "دبي", lat: 25.2048, lng: 55.2708, tz: 4, method: "dubai" },
  { name: "الدوحة", lat: 25.2854, lng: 51.531, tz: 3, method: "ummAlQura" },
  { name: "الكويت", lat: 29.3759, lng: 47.9774, tz: 3, method: "ummAlQura" },
  { name: "عمّان", lat: 31.9454, lng: 35.9284, tz: 3, method: "mwl" },
  { name: "إسطنبول", lat: 41.0082, lng: 28.9784, tz: 3, method: "mwl" },
  { name: "لندن", lat: 51.5072, lng: -0.1276, tz: 0, method: "mwl" },
]

const METHODS = [
  { key: "ummAlQura", name: "أم القرى" },
  { key: "mwl", name: "رابطة العالم الإسلامي" },
  { key: "isna", name: "ISNA" },
  { key: "egypt", name: "المصرية" },
  { key: "karachi", name: "كراتشي" },
  { key: "dubai", name: "دبي" },
]

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1.5 text-xs transition-colors",
        on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
      )}
    >
      {children}
    </button>
  )
}

export function Onboarding() {
  const [step, setStep] = useState(0)
  const [city, setCity] = useState<string | null>(null)
  const [loc, setLoc] = useState({ lat: settings.lat, lng: settings.lng, tz: settings.tz })
  const [method, setMethod] = useState(settings.method)
  const [minutes, setMinutes] = useState(45)
  const [feats, setFeats] = useState({ wird: true, hifz: true, workout: true })
  const [geoMsg, setGeoMsg] = useState("")

  if (settings.onboarded) return null

  const finish = () => {
    saveSettings({
      ...loc,
      method,
      wirdEnabled: feats.wird,
      hifzEnabled: feats.hifz,
      workoutEnabled: feats.workout,
      onboarded: true,
    })
    setPrayerMinutes(minutes) // يطبّقها على بلوكات الصلاة في كل القوالب
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) return setGeoMsg("متصفحك لا يدعم تحديد الموقع")
    setGeoMsg("جارٍ تحديد موقعك…")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({
          lat: +pos.coords.latitude.toFixed(4),
          lng: +pos.coords.longitude.toFixed(4),
          tz: -new Date().getTimezoneOffset() / 60,
        })
        setCity(null)
        setGeoMsg("✅ حُدّد موقعك")
      },
      () => setGeoMsg("تعذّر تحديد موقعك — اختر مدينتك أو أدخل الإحداثيات")
    )
  }

  return (
    <Dialog open>
      <DialogContent className="max-h-[88dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step === 0 ? "أهلًا بك" : step === 1 ? "مدة الصلاة" : "ما الذي تتابعه؟"}</DialogTitle>
          <DialogDescription>
            {step === 0
              ? "جدولك يُبنى على مواقيت الصلاة، فيتحرك معها كل يوم. أين أنت؟"
              : step === 1
                ? "كم تحتاج من الوقت لصلاتك؟"
                : "فعّل ما يعنيك الآن — وكل شيء قابل للتغيير لاحقًا."}
          </DialogDescription>
        </DialogHeader>

        {step === 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1">
              {CITIES.map((c) => (
                <Chip
                  key={c.name}
                  on={city === c.name}
                  onClick={() => {
                    setCity(c.name)
                    setLoc({ lat: c.lat, lng: c.lng, tz: c.tz })
                    setMethod(c.method)
                    setGeoMsg("")
                  }}
                >
                  {c.name}
                </Chip>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={useMyLocation} className="self-start">
              <MapPinIcon />
              استخدم موقعي
            </Button>
            {geoMsg && <p className="text-muted-foreground text-xs">{geoMsg}</p>}

            <div className="flex items-center gap-2">
              <label className="text-muted-foreground flex-none text-xs">خط العرض</label>
              <Input
                type="number"
                step="0.0001"
                value={loc.lat}
                onChange={(e) => setLoc({ ...loc, lat: +e.target.value })}
                className="h-8"
              />
              <label className="text-muted-foreground flex-none text-xs">الطول</label>
              <Input
                type="number"
                step="0.0001"
                value={loc.lng}
                onChange={(e) => setLoc({ ...loc, lng: +e.target.value })}
                className="h-8"
              />
            </div>

            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">طريقة الحساب</span>
              <Help text="تختلف الطرق في زاوية الفجر والعشاء. اختر ما تعمل به بلدك أو مسجدك — وأم القرى هي المعتمدة في السعودية." />
            </div>
            <div className="flex flex-wrap gap-1">
              {METHODS.map((m) => (
                <Chip key={m.key} on={method === m.key} onClick={() => setMethod(m.key)}>
                  {m.name}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed">
              الصلاة تبدأ بالأذان، وبين الأذان والإقامة دعاءٌ لا يُردّ، ثم السنن الرواتب، ثم صلاةٌ
              تحتاج حضور قلب، ثم أذكارها. وهي أهمّ فرصة في يومك — فاجعل وقتها يسعها.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={5}
                max={120}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(5, +e.target.value || 5))}
                className="h-9 w-24"
              />
              <span className="text-muted-foreground text-sm">دقيقة لكل صلاة</span>
              <Help text="ستُطبَّق على الصلوات الخمس. ولتخصيص صلاة بعينها لاحقًا: «قالب يومك» ← افتح البلوك ← غيّر مدته." />
            </div>
            <div className="flex flex-wrap gap-1">
              {[20, 30, 45, 60].map((m) => (
                <Chip key={m} on={minutes === m} onClick={() => setMinutes(m)}>
                  {arab(m)} دقيقة
                </Chip>
              ))}
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              من تصلّي في بيتها أو من يصلّي منفردًا قد يكفيه أقلّ.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-2">
            {(
              [
                ["wird", "الورد في السنن", "تقرأ وردك في السنن الرواتب، ويوزّعه البرنامج عليها بالترتيب — وما فاتك لا يُتخطّى."],
                ["hifz", "الحفظ والمراجعة", "نظام يومي: تسميع جزء، وحفظ ربع، ويوم تكرار — ويتقدّم وحده متى أنجزت."],
                ["workout", "التمرين", "دورة متتابعة لا علاقة لها بأيام الأسبوع، بتقدّم مزدوج: عدة كل جلسة ثم زيادة وزن."],
              ] as [keyof typeof feats, string, string][]
            ).map(([k, label, help]) => (
              <button
                key={k}
                onClick={() => setFeats((p) => ({ ...p, [k]: !p[k] }))}
                className={cn(
                  "flex items-start gap-2 rounded-md border p-2 text-start transition-colors",
                  feats[k] ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 flex-none items-center justify-center rounded border",
                    feats[k] ? "bg-primary border-primary text-primary-foreground" : "border-border"
                  )}
                >
                  {feats[k] && <CheckIcon className="size-3" />}
                </span>
                <span className="flex-1">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-muted-foreground block text-[11px] leading-relaxed">{help}</span>
                </span>
              </button>
            ))}
            <p className="text-muted-foreground pt-1 text-xs leading-relaxed">
              وستجد بعدها «قالب يومك» لتشكيل بلوكاتك، و«الخزانات» لمشاريعك وأهدافك.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              رجوع
            </Button>
          )}
          <span className="text-muted-foreground text-xs">{arab(step + 1)} من ٣</span>
          <Button className="ms-auto" onClick={() => (step < 2 ? setStep(step + 1) : finish())}>
            {step < 2 ? "التالي" : "ابدأ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
