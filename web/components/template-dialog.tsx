"use client"

import { useState } from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  DownloadIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Help } from "@/components/help"
import { arab, DAY_NAMES, fmtDur } from "@/lib/format"
import {
  addBlock,
  currentDayStart,
  dayStartOptions,
  DEFAULT_TEMPLATES,
  duplicateTemplate,
  moveBlock,
  removeTemplate,
  renameTemplate,
  templateName,
  todayIso,
  prayerMinutesOf,
  removeBlock,
  resetTemplates,
  saveSettings,
  setDayStart,
  setPrayerMinutes,
  settings,
  updateBlock,
  type Block,
} from "@/lib/store"

const COLORS: { id: number; name: string; cls: string }[] = [
  { id: 10, name: "أخضر", cls: "bg-emerald-600" },
  { id: 9, name: "أزرق", cls: "bg-blue-600" },
  { id: 6, name: "برتقالي", cls: "bg-orange-500" },
  { id: 8, name: "رمادي", cls: "bg-zinc-400" },
]

// الصلوات الخمس التي لها مدة (والشروق مرساة لا صلاة)
const PRAYER_DURATIONS: [string, string][] = [
  ["fajr", "الفجر"],
  ["dhuhr", "الظهر"],
  ["asr", "العصر"],
  ["maghrib", "المغرب"],
  ["isha", "العشاء"],
]

const PRAYERS: { key: string; name: string }[] = [
  { key: "fajr", name: "الفجر" },
  { key: "sunrise", name: "الشروق" },
  { key: "dhuhr", name: "الظهر" },
  { key: "asr", name: "العصر" },
  { key: "maghrib", name: "المغرب" },
  { key: "isha", name: "العشاء" },
]

// وصف نهاية البلوك نصًّا — حتى يفهم المستخدم متى ينتهي بلا أن يقرأ بيانات
// البلوك المرتبط بصلاته نفسِها: إزاحتُه هي مدتُه لا إزاحةٌ عن شيء آخر
export function isSelfPaced(b: Block): boolean {
  return b.end.prayer === b.id && !b.end.next
}

function endLabel(b: Block): string {
  const e = b.end
  if (e.balance) {
    const t = e.balance.targetMax ?? e.balance.target ?? 0
    const lo = e.balance.targetMin
    return lo && lo !== t
      ? `يُكمل نومك إلى ما بين ${fmtDur(lo)} و${fmtDur(t)}`
      : `يُكمل نومك إلى ${fmtDur(t)}`
  }
  if (e.len != null) return `${fmtDur(e.len)} من بدايته`
  if (isSelfPaced(b)) return `${fmtDur(e.offset || 0)} من أذانه`
  if (e.prayer) {
    const name = PRAYERS.find((p) => p.key === e.prayer)?.name || e.prayer
    if (!e.offset) return `عند ${name}`
    return e.offset > 0 ? `بعد ${name} بـ${fmtDur(e.offset)}` : `قبل ${name} بـ${fmtDur(-e.offset)}`
  }
  if (e.nightPart) {
    const names: Record<number, string> = { 1: "سدس الليل الأول", 2: "ثلث الليل", 3: "نصف الليل", 4: "الثلث الأخير", 5: "السدس الأخير", 6: "آخر الليل" }
    const base = names[e.nightPart] || `${arab(e.nightPart)}/٦ من الليل`
    if (!e.offset) return `عند ${base}`
    return e.offset > 0 ? `بعد ${base} بـ${fmtDur(e.offset)}` : `قبل ${base} بـ${fmtDur(-e.offset)}`
  }
  if (e.nightFraction) {
    const base = e.nightFraction === 1 ? "ثلث الليل" : "ثلثي الليل"
    if (!e.offset) return `عند ${base}`
    return e.offset > 0 ? `بعد ${base} بـ${fmtDur(e.offset)}` : `قبل ${base} بـ${fmtDur(-e.offset)}`
  }
  if (e.nightPrev) return "من الليلة السابقة"
  if (e.prevDay) return "من أمس"
  if (e.lastThirdPrev) return "مطلع الثلث الأخير من الليلة السابقة"
  if (e.clock != null)
    return `عند ${arab(Math.floor(e.clock / 60))}:${arab(String(e.clock % 60).padStart(2, "0"))}`
  return "—"
}

// صورة المرساة — بها يُبدَّل نوعُ نهاية البلوك لا رقمُها وحده
type Kind = "prayer" | "night" | "clock" | "len" | "balance"
const kindOf = (e: Block["end"]): Kind =>
  e.balance ? "balance" : e.len != null ? "len" : e.clock != null ? "clock" : e.nightFraction ? "night" : "prayer"

const KINDS: [Kind, string][] = [
  ["prayer", "صلاة"],
  ["night", "ثلث الليل"],
  ["clock", "ساعة"],
  ["len", "مدة ثابتة"],
]

function anchorOfKind(k: Kind, prev: Block["end"]): Block["end"] {
  if (k === "prayer") return { prayer: prev.prayer || "dhuhr", offset: 0 }
  if (k === "night") return { nightFraction: prev.nightFraction || 1, offset: 0 }
  if (k === "clock") return { clock: prev.clock ?? 6 * 60 }
  return { len: prev.len ?? 45 }
}

function Tick({ on, label, help, onClick }: { on: boolean; label: string; help: string; onClick: () => void }) {
  return (
    <div className="flex items-start gap-2">
      <button onClick={onClick} className="flex items-start gap-2 text-start">
        <span
          className={cn(
            "mt-0.5 flex size-4 flex-none items-center justify-center rounded border",
            on ? "bg-primary border-primary text-primary-foreground" : "border-border"
          )}
        >
          {on && <CheckIcon className="size-3" />}
        </span>
        <span className="text-xs">{label}</span>
      </button>
      <Help text={help} />
    </div>
  )
}

function BlockRow({
  tplId,
  block,
  index,
  count,
}: {
  tplId: string
  block: Block
  index: number
  count: number
}) {
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState("")
  // التعديل يُردّ إن قلب اليوم، فتظهر الرسالة مكانها ولا يُحفظ شيء
  const set = (patch: Partial<Block>) => setErr(updateBlock(tplId, block.id, patch) || "")
  const kind = kindOf(block.end)
  const setEnd = (end: Block["end"]) => set({ end })
  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center gap-2">
        <span className={cn("size-3 flex-none rounded-full", COLORS.find((c) => c.id === block.colorId)?.cls)} />
        <button onClick={() => setOpen((v) => !v)} className="flex flex-1 items-center gap-2 text-start">
          <span className="flex-1">
            <span className="text-sm font-medium">{block.title}</span>
            <span className="text-muted-foreground block text-[11px]">ينتهي {endLabel(block)}</span>
          </span>
          <ChevronDownIcon className={cn("size-4 flex-none transition-transform", !open && "-rotate-90")} />
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex items-center gap-2">
            <label className="text-muted-foreground flex-none text-xs">الاسم</label>
            <Input value={block.title} onChange={(e) => set({ title: e.target.value })} className="h-8" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground flex-none text-xs">اللون</span>
            <div className="flex gap-1">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => set({ colorId: c.id })}
                  aria-label={c.name}
                  className={cn(
                    "size-6 rounded-full border-2",
                    c.cls,
                    block.colorId === c.id ? "border-foreground" : "border-transparent"
                  )}
                />
              ))}
            </div>
          </div>

          {/* نوع النهاية — لا رقمُها وحده. وبلوكات الصلاة والقرآن تبقى على صورتها */}
          {!block.gen && !block.end.balance && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-muted-foreground me-1 flex-none text-xs">ينتهي عند</span>
              {KINDS.map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setEnd(anchorOfKind(k, block.end))}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-xs transition-colors",
                    kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* أيّ صلاة — كان البلوك يُخلق على صلاته فلا يبرحها */}
          {kind === "prayer" && !isSelfPaced(block) && (
            <div className="flex flex-wrap gap-1">
              {PRAYERS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setEnd({ ...block.end, prayer: p.key })}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-xs transition-colors",
                    block.end.prayer === p.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {kind === "night" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1">
                {[1, 2].map((k) => (
                  <button
                    key={k}
                    onClick={() => setEnd({ ...block.end, nightFraction: k })}
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-xs transition-colors",
                      block.end.nightFraction === k
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    {k === 1 ? "ثلث الليل" : "ثلثا الليل"}
                  </button>
                ))}
              </div>
              <label className="text-muted-foreground flex-none text-xs">إزاحة</label>
              <Input
                type="number"
                value={block.end.offset || 0}
                onChange={(e) => setEnd({ ...block.end, offset: +e.target.value || 0 })}
                className="h-8 w-20"
              />
              <Help text="الليل من المغرب إلى فجر الغد، فثلثه وثلثاه يتحركان مع الفصول. وسالب الإزاحة قبله وموجبها بعده." />
            </div>
          )}

          {kind === "clock" && (
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground flex-none text-xs">الساعة</label>
              <Input
                type="time"
                value={`${String(Math.floor((block.end.clock ?? 0) / 60)).padStart(2, "0")}:${String((block.end.clock ?? 0) % 60).padStart(2, "0")}`}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":").map(Number)
                  if (Number.isFinite(h)) setEnd({ clock: h * 60 + m })
                }}
                className="h-8 w-28"
              />
              <Help text="ساعةٌ ثابتة لا تتحرك بالمواقيت — لمن كان في يومه موعدٌ لا يتبع الشمس." />
            </div>
          )}

          {kind === "len" && (
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground flex-none text-xs">المدة (دقيقة)</label>
              <Input
                type="number"
                min={5}
                max={600}
                value={block.end.len}
                onChange={(e) => setEnd({ ...block.end, len: Math.max(5, +e.target.value || 5) })}
                className="h-8 w-24"
              />
              <Help text="مدة البلوك من بدايته. لبلوكات الصلاة: من الأذان حتى فراغك من السنة والأذكار." />
            </div>
          )}

          {/* نومة التوازن: أرقامها كانت ثابتة في الشيفرة والواجهة تقول إنك حدّدتها */}
          {block.end.balance && (
            <div className="flex flex-col gap-1.5 rounded-md border p-2">
              <div className="flex items-center gap-1 text-xs">
                نومة التوازن
                <Help text="هذه النومة تُكمل مجموع نومك إلى الهدف: فإن قصرت ليلتك طالت هي وقصر عملك، وإن طالت ليلتك انكمشت. ولها حدّ أدنى وأعلى، وتُبقي بعدها فسحةً لا تأكلها." />
              </div>
              {(
                [
                  ["target", "مجموع نومك"],
                  ["min", "أقلّها"],
                  ["max", "أكثرها"],
                  ["keepAfter", "تُبقي بعدها"],
                ] as ["target" | "min" | "max" | "keepAfter", string][]
              ).map(([k, label]) => (
                <div key={k} className="flex items-center gap-2">
                  <label className="text-muted-foreground w-24 flex-none text-xs">{label}</label>
                  <Input
                    type="number"
                    min={0}
                    max={900}
                    value={block.end.balance![k]}
                    onChange={(e) =>
                      setEnd({
                        ...block.end,
                        balance: { ...block.end.balance!, [k]: Math.max(0, +e.target.value || 0) },
                      })
                    }
                    className="h-8 w-20"
                  />
                  <span className="text-muted-foreground text-[11px]">دقيقة</span>
                </div>
              ))}
            </div>
          )}

          {isSelfPaced(block) && (
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground flex-none text-xs">المدة (دقيقة)</label>
              <Input
                type="number"
                min={5}
                max={180}
                value={block.end.offset || 0}
                onChange={(e) => set({ end: { ...block.end, offset: Math.max(5, +e.target.value || 5) } })}
                className="h-8 w-24"
              />
              <Help text="من الأذان حتى فراغك من السنة والأذكار. وبلوك الجمعة يبدأ قبل الأذان بساعة فيسع الخطبة، فمدتُه هذه زائدًا ساعة." />
            </div>
          )}

          {kind === "prayer" && !isSelfPaced(block) && (
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground flex-none text-xs">
                إزاحة عن {PRAYERS.find((p) => p.key === block.end.prayer)?.name} (دقيقة)
              </label>
              <Input
                type="number"
                value={block.end.offset || 0}
                onChange={(e) => set({ end: { ...block.end, offset: +e.target.value || 0 } })}
                className="h-8 w-24"
              />
              <Help text="سالب يعني قبل الوقت، وموجب يعني بعده. مثاله تبكير الجمعة: −٦٠." />
            </div>
          )}

          {/* أعلام البلوك: نومٌ يُحتسب في مجموع نومك، ووقتٌ حرّ لا يُطالبك بشيء */}
          {!block.gen && (
            <Tick
              on={!!block.sleep}
              label="هذا البلوك نوم"
              help="يُحتسب في مجموع نومك، فتقصر نومةُ التوازن بقدره. ومن أضاف نومةً بلا هذا العلَم زاد نومُه عن هدفه."
              onClick={() => set({ sleep: !block.sleep, task: block.sleep ? block.task : false })}
            />
          )}

          {!block.gen && (
            <Tick
              on={!!block.transparent}
              label="وقت حرّ"
              help="يُعرض باهتًا ولا يُطالبك بشيء — كبلوك الراحة: لك أن تملأه ولك أن تتركه."
              onClick={() => set({ transparent: !block.transparent })}
            />
          )}

          {/* بلوك المهام: يقبل مهامك اليدوية ويستقبل القضاء والتقديم */}
          {!block.gen && !block.sleep && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => set({ task: !block.task })}
                className="flex items-center gap-2 text-start"
              >
                <span
                  className={cn(
                    "flex size-4 flex-none items-center justify-center rounded border",
                    block.task ? "bg-primary border-primary text-primary-foreground" : "border-border"
                  )}
                >
                  {block.task && <CheckIcon className="size-3" />}
                </span>
                <span className="text-xs">بلوك مهام</span>
              </button>
              <Help text="بلوك المهام يقبل ما تضيفه من مهام ومهام الخزانات، ويستقبل ما فاتك قضاءً وما تريد تقديمه. أما النوم والصلوات فلا." />
            </div>
          )}

          {/* الترتيب: كان يُحدَّد مرة عند الإنشاء فلا يُصحَّح بعدها */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground me-1 flex-none text-xs">موضعه</span>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              aria-label="إلى الأعلى"
              disabled={index === 0}
              onClick={() => setErr(moveBlock(tplId, block.id, -1) || "")}
            >
              <ChevronUpIcon />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              aria-label="إلى الأسفل"
              disabled={index === count - 1}
              onClick={() => setErr(moveBlock(tplId, block.id, 1) || "")}
            >
              <ChevronDownIcon />
            </Button>
            <span className="text-muted-foreground text-[11px]">
              {arab(index + 1)} من {arab(count)}
            </span>
          </div>

          {err && <p className="text-destructive text-[11px] leading-relaxed">{err}</p>}

          {!block.gen && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive self-start"
              onClick={() => removeBlock(tplId, block.id)}
            >
              <Trash2Icon />
              حذف البلوك
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function TemplateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [openTpl, setOpenTpl] = useState<string | null>(null)
  // تُملأ من قالبك لا من رقمٍ مفترض — وكانت تقول ٤٥ ولو كانت صلاتك ٣٠
  const [minutes, setMinutes] = useState(() => prayerMinutesOf().fajr ?? 45)
  const [adding, setAdding] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState("")
  const [newAfter, setNewAfter] = useState("dhuhr")
  const [newClock, setNewClock] = useState("06:00")
  const [newSleep, setNewSleep] = useState(false)
  const [tplErr, setTplErr] = useState("")
  const [perPrayer, setPerPrayer] = useState(false)
  const [mins, setMins] = useState<Record<string, number>>(() => prayerMinutesOf())
  const [startErr, setStartErr] = useState("")
  // الردّ لا بدّ أن يُرى: رفضٌ صامت يبدو زرًّا معطوبًا
  const [durErr, setDurErr] = useState("")
  const ids = Object.keys(settings.templates)
  const ds = currentDayStart()
  const startOpts = dayStartOptions()

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[340px] overflow-y-auto sm:w-[420px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            قالب يومك
            <Help text="يومك سلسلة بلوكات متلاصقة، نهايةُ كلٍّ مرتبطة بوقت صلاة أو بثلث الليل أو بمدة ثابتة — وبدايتُه نهايةُ سابقه، فلا تبقى فجوة أبدًا." />
          </SheetTitle>
          <p className="text-muted-foreground text-xs leading-relaxed">
            لكل نوع يوم قالبه، وخطة الأسبوع تسنِد لكل يوم قالبه.
          </p>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4 pb-8">
          {/* مدة الصلاة لكل الصلوات دفعةً واحدة */}
          <div className="rounded-lg border p-2">
            <div className="mb-1 flex items-center gap-1 text-sm font-semibold">
              الصلاة
              <Help text="تبدأ الصلاة بالأذان، وبين الأذان والإقامة دعاءٌ مستجاب، ثم السنن، ثم الصلاة بتركيز، ثم أذكارها. اجعل الوقت يسع عباداتك في أهم فرصة في يومك." />
            </div>
            {!perPrayer && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={5}
                  max={180}
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(5, +e.target.value || 5))}
                  className="h-8 w-24"
                />
                <Button size="sm" onClick={() => setDurErr(setPrayerMinutes(minutes) || "")}>
                  طبّق على كل الصلوات
                </Button>
              </div>
            )}

            {/* إفصاحٌ متدرّج: الخانات الخمس لمن طلبها وحده */}
            <button
              onClick={() => {
                setMins(prayerMinutesOf()) // تُملأ من قوالبك الحالية لا من رقمٍ مفترض
                setPerPrayer((v) => !v)
              }}
              className="mt-1 flex items-center gap-2 text-start"
            >
              <span
                className={cn(
                  "flex size-4 flex-none items-center justify-center rounded border",
                  perPrayer ? "bg-primary border-primary text-primary-foreground" : "border-border"
                )}
              >
                {perPrayer && <CheckIcon className="size-3" />}
              </span>
              <span className="text-xs">لكل صلاة مدتها</span>
            </button>

            {durErr && <p className="text-destructive pt-1 text-[11px] leading-relaxed">{durErr}</p>}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground flex-none text-xs">بين الأذان والإقامة</span>
              <Help text="بندٌ يظهر في كل بلوك صلاة. وهو وقتٌ لا يُردّ فيه الدعاء — فاملأه بما شئت: دعاءً أو ذكرًا أو كتابةً." />
            </div>
            <Input
              defaultValue={settings.betweenLine}
              onBlur={(e) => saveSettings({ betweenLine: e.target.value.trim() || settings.betweenLine })}
              className="h-8"
            />

            {perPrayer && (
              <div className="mt-2 flex flex-col gap-1.5">
                {PRAYER_DURATIONS.map(([key, name]) => (
                  <div key={key} className="flex items-center gap-2">
                    <label className="w-14 flex-none text-xs">{name}</label>
                    <Input
                      type="number"
                      min={5}
                      max={180}
                      value={mins[key] ?? 45}
                      onChange={(e) => setMins((p) => ({ ...p, [key]: Math.max(5, +e.target.value || 5) }))}
                      className="h-8 w-20"
                    />
                    <span className="text-muted-foreground text-[11px]">دقيقة</span>
                  </div>
                ))}
                <Button size="sm" className="mt-1 self-start" onClick={() => setDurErr(setPrayerMinutes(mins) || "")}>
                  احفظ المدد
                </Button>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  تُطبَّق على كل قوالبك. ومدة الجمعة تتبع الظهر وتزيد ساعة تلقائيًا.
                </p>
              </div>
            )}
          </div>

          {/* بداية اليوم */}
          <div className="rounded-lg border p-2">
            <div className="mb-1 flex items-center gap-1 text-sm font-semibold">
              بداية يومك
              <Help text="يومك حلقةٌ لا خطّ: تختار أيّ بلوك يفتتحه، فما قبله ينتقل إلى ما بعده ويبقى الترتيب. وهي واحدة لكل قوالبك، وإلا تداخلت أيامك." />
            </div>
            <p className="text-muted-foreground mb-2 text-[11px] leading-relaxed">
              اليوم يبدأ ببلوك «{startOpts.find((o) => o.id === ds.blockId)?.title || ds.blockId}»
              {ds.clock != null && ` عند ${arab(Math.floor(ds.clock / 60))}:${arab(String(ds.clock % 60).padStart(2, "0"))}`}.
            </p>
            <div className="flex flex-wrap gap-1">
              {startOpts.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setStartErr(setDayStart({ blockId: o.id }) || "")}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs transition-colors",
                    ds.blockId === o.id && ds.clock == null
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  )}
                >
                  {o.title}
                </button>
              ))}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="text-muted-foreground flex-none text-xs">أو عند ساعة</span>
              <Input
                type="time"
                defaultValue={
                  ds.clock != null
                    ? `${String(Math.floor(ds.clock / 60)).padStart(2, "0")}:${String(ds.clock % 60).padStart(2, "0")}`
                    : "03:00"
                }
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":").map(Number)
                  if (!Number.isFinite(h)) return
                  setStartErr(setDayStart({ blockId: ds.blockId, anchor: { clock: h * 60 + m } }) || "")
                }}
                className="h-8 w-28"
              />
              <Help text="ساعةٌ ثابتة لا تتحرك بالمواقيت. ولا تصلح كل ساعة: إن كانت بعد نهاية أوّل بلوك انقلب اليوم، فيردّها البرنامج." />
            </div>
            {startErr && <p className="text-destructive pt-1 text-[11px] leading-relaxed">{startErr}</p>}
            {settings.dayStart && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground mt-1"
                onClick={() => {
                  setStartErr("")
                  setDayStart(null)
                }}
              >
                <RotateCcwIcon />
                أرجِع البداية الأصلية
              </Button>
            )}
          </div>

          {/* خطة الأيام: أسبوعية أو دورة لا تعرف الأسبوع */}
          <div className="rounded-lg border p-2">
            <div className="mb-2 flex items-center gap-1 text-sm font-semibold">
              خطة الأيام
              <Help text="أسبوعية: لكل يوم أسبوعٍ قالبُه. أو دورة: قوالبُ تتعاقب من يوم بدايتها بلا نظر إلى الأسبوع — لمن لا فرق عنده بين جمعةٍ وغيرها." />
            </div>
            <div className="mb-2 flex flex-wrap gap-1">
              {(
                [
                  ["weekly", "أسبوعية"],
                  ["cycle", "دورة متتابعة"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() =>
                    saveSettings(
                      m === "cycle"
                        ? { planMode: m, cyclePlan: settings.cyclePlan ?? { start: todayIso(), seq: [ids[0]] } }
                        : { planMode: m }
                    )
                  }
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-xs",
                    settings.planMode === m ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {settings.planMode === "cycle" && settings.cyclePlan && (
              <div className="mb-2 flex flex-col gap-1">
                <div className="text-muted-foreground text-[11px]">أيام الدورة بترتيبها — تدور من {settings.cyclePlan.start}:</div>
                {settings.cyclePlan.seq.map((tid, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-1">
                    <span className="text-muted-foreground w-12 flex-none text-[11px]">يوم {arab(i + 1)}</span>
                    {ids.map((id) => (
                      <button
                        key={id}
                        onClick={() => {
                          const seq = [...settings.cyclePlan!.seq]
                          seq[i] = id
                          saveSettings({ cyclePlan: { ...settings.cyclePlan!, seq } })
                        }}
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-xs",
                          tid === id ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        )}
                      >
                        {templateName(id)}
                      </button>
                    ))}
                    {settings.cyclePlan!.seq.length > 1 && (
                      <button
                        onClick={() =>
                          saveSettings({
                            cyclePlan: { ...settings.cyclePlan!, seq: settings.cyclePlan!.seq.filter((_, k) => k !== i) },
                          })
                        }
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="حذف يوم من الدورة"
                      >
                        <Trash2Icon className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => saveSettings({ cyclePlan: { ...settings.cyclePlan!, seq: [...settings.cyclePlan!.seq, ids[0]] } })}
                >
                  <PlusIcon />
                  يوم في الدورة
                </Button>
              </div>
            )}
            <div className="mb-2 text-sm font-semibold">{settings.planMode === "weekly" ? "خطة الأسبوع" : "خطة الأسبوع (معطّلة — الدورة تحكم)"}</div>
            <div className="flex flex-col gap-1">
              {DAY_NAMES.map((name, i) => (
                <div key={name} className="flex items-center gap-2 text-xs">
                  <span className="w-14 flex-none">{name}</span>
                  <div className="flex flex-wrap gap-1">
                    {ids.map((id) => (
                      <button
                        key={id}
                        onClick={() => {
                          const next = [...settings.weekPlan]
                          next[i] = id
                          saveSettings({ weekPlan: next })
                        }}
                        className={cn(
                          "rounded-md border px-2 py-0.5 transition-colors",
                          settings.weekPlan[i] === id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        {templateName(id)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* القوالب وبلوكاتها */}
          {ids.map((id) => {
            const tpl = settings.templates[id as keyof typeof settings.templates]
            const isOpen = openTpl === id
            return (
              <div key={id} className="rounded-lg border p-2">
                <button
                  onClick={() => setOpenTpl(isOpen ? null : id)}
                  className="flex w-full items-center gap-2 text-start"
                >
                  <ChevronDownIcon className={cn("size-4 flex-none transition-transform", !isOpen && "-rotate-90")} />
                  <span className="flex-1 text-sm font-semibold">{templateName(id)}</span>
                  <span className="text-muted-foreground text-[11px]">{arab(tpl.blocks.length)} بلوك</span>
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-2 pt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-muted-foreground flex-none text-xs">اسم القالب</label>
                      <Input
                        defaultValue={templateName(id)}
                        onBlur={(e) => renameTemplate(id, e.target.value.trim() || templateName(id))}
                        className="h-8 w-36"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenTpl(duplicateTemplate(id, templateName(id) + " (نسخة)"))}
                      >
                        <CopyIcon />
                        انسخه
                      </Button>
                      {ids.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setTplErr(removeTemplate(id) || "")}
                        >
                          <Trash2Icon />
                          احذفه
                        </Button>
                      )}
                    </div>
                    {tplErr && <p className="text-destructive text-[11px]">{tplErr}</p>}
                    {tpl.blocks.map((b, i) => (
                      <BlockRow
                        key={b.id}
                        tplId={id}
                        block={b as Block}
                        index={i}
                        count={tpl.blocks.length}
                      />
                    ))}

                    {adding === id ? (
                      <div className="flex flex-col gap-2 rounded-md border p-2">
                        <Input
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="اسم البلوك…"
                          autoFocus
                        />
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-muted-foreground">ينتهي عند</span>
                          <Help text="البلوك الجديد يبدأ حيث انتهى سابقه وينتهي عند الوقت الذي تختاره، والبلوك الذي كان بعده يقصر بقدره." />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {PRAYERS.map((p) => (
                            <button
                              key={p.key}
                              onClick={() => setNewAfter(p.key)}
                              className={cn(
                                "rounded-md border px-2 py-1 text-xs transition-colors",
                                newAfter === p.key
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border hover:bg-muted"
                              )}
                            >
                              {p.name}
                            </button>
                          ))}
                          <button
                            onClick={() => setNewAfter("clock")}
                            className={cn(
                              "rounded-md border px-2 py-1 text-xs transition-colors",
                              newAfter === "clock"
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border hover:bg-muted"
                            )}
                          >
                            ساعة
                          </button>
                        </div>
                        {newAfter === "clock" && (
                          <Input
                            type="time"
                            value={newClock}
                            onChange={(e) => setNewClock(e.target.value)}
                            className="h-8 w-28"
                          />
                        )}
                        <button
                          onClick={() => setNewSleep((v) => !v)}
                          className="flex items-center gap-2 text-start"
                        >
                          <span
                            className={cn(
                              "flex size-4 flex-none items-center justify-center rounded border",
                              newSleep ? "bg-primary border-primary text-primary-foreground" : "border-border"
                            )}
                          >
                            {newSleep && <CheckIcon className="size-3" />}
                          </span>
                          <span className="text-xs">هذا البلوك نوم</span>
                        </button>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!newTitle.trim()) return
                              const [h, m] = newClock.split(":").map(Number)
                              const end =
                                newAfter === "clock" ? { clock: h * 60 + m } : { prayer: newAfter }
                              const e = addBlock(id, newTitle.trim(), end, { sleep: newSleep })
                              if (e) return setTplErr(e)
                              setTplErr("")
                              setNewTitle("")
                              setAdding(null)
                            }}
                          >
                            <PlusIcon />
                            أضف
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>
                            إلغاء
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setAdding(id)}>
                        <PlusIcon />
                        بلوك
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setOpenTpl(duplicateTemplate(ids[0], "قالب جديد"))}
          >
            <PlusIcon />
            قالب يوم
          </Button>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            القالب الجديد نسخةٌ من أوّل قوالبك تعدّلها كما تشاء، ثم تُسنده إلى أيامه من «خطة الأسبوع».
          </p>

          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground self-start"
            onClick={() => resetTemplates()}
          >
            <RotateCcwIcon />
            استعادة القوالب الافتراضية
          </Button>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            القوالب الافتراضية {arab(Object.keys(DEFAULT_TEMPLATES).length)}: أيام العمل، والجمعة، والسبت.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
