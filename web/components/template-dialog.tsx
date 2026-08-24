"use client"

import { useState } from "react"
import { ChevronDownIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Help } from "@/components/help"
import { arab, DAY_NAMES, fmtDur } from "@/lib/format"
import {
  addBlock,
  DEFAULT_TEMPLATES,
  removeBlock,
  resetTemplates,
  saveSettings,
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

const PRAYERS: { key: string; name: string }[] = [
  { key: "fajr", name: "الفجر" },
  { key: "sunrise", name: "الشروق" },
  { key: "dhuhr", name: "الظهر" },
  { key: "asr", name: "العصر" },
  { key: "maghrib", name: "المغرب" },
  { key: "isha", name: "العشاء" },
]

// وصف نهاية البلوك نصًّا — حتى يفهم المستخدم متى ينتهي بلا أن يقرأ بيانات
function endLabel(b: Block): string {
  const e = b.end
  if (e.balance) return "يُكمل نومك إلى المجموع الذي حدّدته"
  if (e.len != null) return `${fmtDur(e.len)} من بدايته`
  if (e.prayer) {
    const name = PRAYERS.find((p) => p.key === e.prayer)?.name || e.prayer
    if (!e.offset) return `عند ${name}`
    return e.offset > 0 ? `بعد ${name} بـ${fmtDur(e.offset)}` : `قبل ${name} بـ${fmtDur(-e.offset)}`
  }
  if (e.nightFraction) {
    const base = e.nightFraction === 1 ? "ثلث الليل" : "ثلثي الليل"
    if (!e.offset) return `عند ${base}`
    return e.offset > 0 ? `بعد ${base} بـ${fmtDur(e.offset)}` : `قبل ${base} بـ${fmtDur(-e.offset)}`
  }
  if (e.lastThirdPrev) return "مطلع الثلث الأخير من الليلة السابقة"
  return "—"
}

function BlockRow({ tplId, block }: { tplId: string; block: Block }) {
  const [open, setOpen] = useState(false)
  const set = (patch: Partial<Block>) => updateBlock(tplId, block.id, patch)
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

          {block.end.len != null && (
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground flex-none text-xs">المدة (دقيقة)</label>
              <Input
                type="number"
                min={5}
                max={240}
                value={block.end.len}
                onChange={(e) => set({ end: { ...block.end, len: Math.max(5, +e.target.value || 5) } })}
                className="h-8 w-24"
              />
              <Help text="مدة البلوك من بدايته. لبلوكات الصلاة: من الأذان حتى فراغك من السنة والأذكار." />
            </div>
          )}

          {block.end.prayer && (
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground flex-none text-xs">إزاحة عن {PRAYERS.find((p) => p.key === block.end.prayer)?.name} (دقيقة)</label>
              <Input
                type="number"
                value={block.end.offset || 0}
                onChange={(e) => set({ end: { ...block.end, offset: +e.target.value || 0 } })}
                className="h-8 w-24"
              />
              <Help text="سالب يعني قبل الوقت، وموجب يعني بعده. مثاله تبكير الجمعة: −٦٠." />
            </div>
          )}

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
  const [minutes, setMinutes] = useState(45)
  const [adding, setAdding] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState("")
  const [newAfter, setNewAfter] = useState("dhuhr")
  const ids = Object.keys(settings.templates)

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
              مدة الصلاة
              <Help text="تبدأ الصلاة بالأذان، وبين الأذان والإقامة دعاءٌ مستجاب، ثم السنن، ثم الصلاة بتركيز، ثم أذكارها. اجعل الوقت يسع عباداتك في أهم فرصة في يومك." />
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={5}
                max={120}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(5, +e.target.value || 5))}
                className="h-8 w-24"
              />
              <Button size="sm" onClick={() => setPrayerMinutes(minutes)}>
                طبّق على كل الصلوات
              </Button>
            </div>
            <p className="text-muted-foreground pt-1 text-[11px]">
              ولتخصيص صلاة بعينها، افتح قالبها أدناه وغيّر مدتها وحدها.
            </p>
          </div>

          {/* خطة الأسبوع */}
          <div className="rounded-lg border p-2">
            <div className="mb-2 text-sm font-semibold">خطة الأسبوع</div>
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
                        {id}
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
                  <span className="flex-1 text-sm font-semibold">{id}</span>
                  <span className="text-muted-foreground text-[11px]">{arab(tpl.blocks.length)} بلوك</span>
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-2 pt-2">
                    {tpl.blocks.map((b) => (
                      <BlockRow key={b.id} tplId={id} block={b as Block} />
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
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!newTitle.trim()) return
                              addBlock(id, newTitle.trim(), { prayer: newAfter })
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
