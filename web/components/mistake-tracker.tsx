"use client"

import { useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { arab } from "@/lib/engine/dates.js"
import { addMistake, currentUnit, mistakesFor, removeMistake } from "@/lib/store"

// متتبّع أخطاء مكان قرآني واحد (تسميع جزء / حفظ-تكرار ربع / تثبيت نصف حزب):
// إدخال بسيط — رقم الآية والكلمة فقط — والأخطاء القديمة (من قبل اليوم) تبقى ظاهرة حتى تُحذف
export function MistakeTracker({ poolKey }: { poolKey: string }) {
  const [ayah, setAyah] = useState("")
  const [word, setWord] = useState("")
  const list = mistakesFor(poolKey)
  const today = currentUnit()

  const submit = () => {
    if (!ayah.trim() || !word.trim()) return
    addMistake(poolKey, ayah, word)
    setAyah("")
    setWord("")
  }

  return (
    <div
      className="ms-8 flex flex-col gap-1.5 rounded-md bg-red-500/5 p-2"
      onClick={(e) => e.stopPropagation()}
    >
      {list.length > 0 && (
        <div className="flex flex-col gap-1">
          {list.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 text-xs">
              <span className={cn(m.addedDate < today && "text-amber-600 dark:text-amber-400")}>
                آية {arab(m.ayah)} — {m.word}
                {m.addedDate < today && <span className="ms-1 opacity-70">(قديم)</span>}
              </span>
              <button
                type="button"
                onClick={() => removeMistake(poolKey, m.id)}
                className="text-muted-foreground hover:text-destructive flex-none"
                aria-label="حذف الخطأ"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        <Input
          value={ayah}
          onChange={(e) => setAyah(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="رقم الآية"
          inputMode="numeric"
          className="h-7 w-16 flex-none px-1.5 text-xs"
        />
        <Input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="الكلمة التي أخطأت فيها"
          className="h-7 flex-1 px-1.5 text-xs"
        />
        <Button
          type="button"
          size="icon"
          className="size-7 flex-none"
          onClick={submit}
          aria-label="إضافة الخطأ"
        >
          <PlusIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
