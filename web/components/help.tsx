"use client"

import { useState } from "react"
import { HelpCircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// علامة «؟»: الشرح كله هنا لتبقى الواجهة نظيفة.
// على الحاسب يظهر بمرور المؤشر، وعلى الجوال بالنقر (فقاعة تُغلق بنقرة أخرى).
export function Help({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className={cn("relative inline-flex align-middle", className)}>
      <button
        type="button"
        title={text}
        aria-label={open ? "إغلاق الشرح" : "شرح"}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="text-muted-foreground/70 hover:text-foreground flex-none"
      >
        <HelpCircleIcon className="size-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="bg-popover text-popover-foreground absolute top-5 z-50 w-56 rounded-md border p-2 text-[11px] leading-relaxed shadow-md"
          style={{ insetInlineStart: 0 }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
