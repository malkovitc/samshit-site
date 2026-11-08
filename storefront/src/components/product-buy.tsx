"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import { addToCart } from "@/lib/actions"
import type { LineMode, ProductView } from "@/lib/data"
import { money } from "@/lib/format"
import { OpenSizes, useUi, useSafeTransition } from "./chrome"
import { track } from "./analytics"

const SIZES = ["S", "M", "L", "XL"] as const

export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0)
  const [fade, setFade] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [origin, setOrigin] = useState("50% 50%")
  const pick = (n: number) => { setFade(true); setTimeout(() => { setI(n); setFade(false) }, 220) }
  return (
    <div className={`gal${images.length < 2 ? " single" : ""}`}>
      {images.length > 1 && <div className="thumbs">
        {images.map((src, n) => (
          <button key={src} aria-pressed={n === i} aria-label={String(n + 1)} onClick={() => pick(n)}><img src={src} alt="" /></button>
        ))}
      </div>}
      <div
        className={`stage${zoom ? " zoom" : ""}`}
        onClick={() => setZoom(!zoom)}
        onMouseMove={(e) => {
          if (!zoom) return
          const r = e.currentTarget.getBoundingClientRect()
          setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`)
        }}
      >
        <img src={images[i]} alt={alt} style={{ opacity: fade ? 0 : 1, transformOrigin: origin }} />
      </div>
    </div>
  )
}

export function ProductBuy({ p }: { p: ProductView }) {
  const t = useTranslations("product")
  const ts = useTranslations("status")
  const tz = useTranslations("sizes")
  const locale = useLocale()
  const ui = useUi()
  const router = useRouter()
  const [pending, start] = useSafeTransition()
  const [mode, setMode] = useState<LineMode>(p.status)
  const [size, setSize] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const isMtm = mode === "mtm"
  const price = isMtm && p.mtmPrice != null ? p.mtmPrice : p.price
  const chosen = isMtm ? "MTM" : size
  const label = !chosen
    ? t("selectSize")
    : p.status === "pre" ? t("preorderBtn", { s: chosen })
    : mode === "mto" ? t("mtoBtn", { s: chosen })
    : isMtm ? t("mtmBtn")
    : t("addBtn", { s: chosen })
  const hint =
    mode === "stock" && size && p.stock[size] === 1 ? t("lastOne") : isMtm ? t("mtmHint") : ""
  // готовая вещь: только размеры с остатком; «в моём размере» и предзаказ: любой размер
  const sizeOk = (s: string) => mode !== "stock" || (p.stock[s] ?? 0) > 0

  const add = () =>
    chosen &&
    start(async () => {
      // «в моём размере» при наличии на складе всё равно шьётся заново — так решил покупатель
      await addToCart(p.variants[chosen], mode)
      track("add-to-cart", { product: p.handle, size: chosen, mode, from: "product" })
      setDone(true)
      router.refresh()
      setTimeout(() => { setDone(false); ui.setCartOpen(true) }, 900)
    })

  const pick = (m: LineMode) => {
    setMode(m)
    if (m === "stock" && size && !(p.stock[size] > 0)) setSize(null)
  }

  return (
    <>
      <div className="row"><span className="price tn">{money(price, p.currency, locale)}</span><span className={`st ${p.status}`}>{p.status === "pre" ? ts("preShort") : p.status === "stock" ? ts("stock") : ts("mto", { n: p.leadDays })}</span></div>
      {p.status !== "pre" && (
        <div className="modes u" role="group" aria-label={t("howToGet")}>
          <button aria-pressed={mode === "stock"} disabled={p.status !== "stock"} onClick={() => pick("stock")}>{t("ready")}<small>{t(p.status === "stock" ? "shipsFast" : "notInStock")}</small></button>
          <button aria-pressed={mode === "mto"} onClick={() => pick("mto")}>{t("inMySize")}<small>{t("mtoTerms", { n: p.leadDays })}</small></button>
          {p.mtmPrice != null && (
            <button aria-pressed={isMtm} onClick={() => pick("mtm")}>{t("mtm")}<small>{t("mtmTerms", { p: money(p.mtmPrice - p.price, p.currency, locale), n: p.leadDays + 3 })}</small></button>
          )}
        </div>
      )}
      <div hidden={isMtm}>
        <div className="row u" style={{ marginBottom: 6 }}><span>{tz("size")}</span><OpenSizes className="ln m">{t("sizeChart")}</OpenSizes></div>
        <div className="sizes u">
          {SIZES.map((s) => (
            <button key={s} aria-pressed={size === s} disabled={!sizeOk(s)} onClick={() => setSize(s)}>{s}</button>
          ))}
        </div>
      </div>
      <button className={`add u${done ? " done" : ""}`} disabled={!chosen || pending} onClick={add}>
        <span className="a">{label}</span><span className="b">{t("addedOk")}</span>
      </button>
      <div className="hint u">{hint}</div>
    </>
  )
}
