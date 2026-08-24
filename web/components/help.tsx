"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { HelpCircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// علامة «؟»: الشرح كله هنا لتبقى الواجهة نظيفة.
// على الحاسب يظهر بمرور المؤشر، وعلى الجوال بالنقر (فقاعة تُغلق بنقرة أخرى).
//
// والفقاعة تُقاس عند فتحها وتُحبَس داخل الشاشة: كانت تُرسى عند بداية العلامة بعرض
// ثابت، فإن كانت العلامة قرب الحافة خرج الشرح عن الشاشة وقُصّ — وأشدّ ما يكون ذلك
// على الجوال، حيث ألواحُ الإعدادات ضيّقة والشرح فيها أكثر ما يكون.
export function Help({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return setPos(null)
    const place = () => {
      const b = btnRef.current
      if (!b) return
      const r = b.getBoundingClientRect()
      const pad = 12
      const width = Math.min(224, window.innerWidth - pad * 2)
      const wanted = document.dir === "rtl" ? r.right - width : r.left
      const left = Math.max(pad, Math.min(wanted, window.innerWidth - width - pad))
      setPos({ top: r.bottom + 6, left, width })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [open])

  return (
    <span className={cn("relative inline-flex align-middle", className)}>
      <button
        ref={btnRef}
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
      {open && pos && (
        <span
          role="tooltip"
          className="bg-popover text-popover-foreground fixed z-50 rounded-md border p-2 text-[11px] leading-relaxed shadow-md"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
