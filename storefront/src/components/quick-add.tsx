"use client"

import { useTransition } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import { addToCart } from "@/lib/actions"
import type { LineMode } from "@/lib/data"
import { useUi } from "./chrome"
import { track } from "./analytics"

type Opt = { label: string; variantId: string; mode: LineMode; disabled: boolean; wide?: boolean }

export function QuickAdd({ title, options }: { title: string; options: Opt[] }) {
  const t = useTranslations("shop")
  const ui = useUi()
  const router = useRouter()
  const [pending, start] = useTransition()
  const add = (o: Opt) =>
    start(async () => {
      await addToCart(o.variantId, o.mode)
      track("add-to-cart", { product: title, size: o.label, mode: o.mode, from: "grid" })
      ui.toast(t("added", { n: `${title.split(" — ")[0]}, ${o.label}` }))
      router.refresh()
    })
  return (
    <div className="quick u" aria-busy={pending}>
      {options.map((o) => (
        <button key={o.label} disabled={o.disabled || pending} onClick={() => add(o)}>
          {o.wide ? t(o.mode === "pre" ? "quickPre" : "quickMake") : o.label}
        </button>
      ))}
    </div>
  )
}
