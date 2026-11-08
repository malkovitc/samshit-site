"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import { placeOrder, shippingOptionsFor } from "@/lib/actions"
import type { CartView } from "@/lib/cart-view"
import { money } from "@/lib/format"
import { track } from "./analytics"

type Opt = { id: string; name: string; code: string; amount: number }

// Подписи вариантов доставки по коду опции из Medusa; без кода — имя опции из админки.
const SHIP_KEYS: Record<string, [string, string]> = {
  pickup: ["shipPickup", "shipPickupSub"],
  "tbilisi-courier": ["shipCourier", "shipCourierSub"],
  "dhl-express": ["shipDhl", "shipDhlSub"],
}

export function CheckoutForm({ cart, countries, initialCountry }: { cart: CartView; countries: { code: string; name: string }[]; initialCountry: string }) {
  const t = useTranslations("checkout")
  const tm = useTranslations("mode")
  const tc = useTranslations("common")
  const tn = useTranslations("nav")
  const locale = useLocale()
  const router = useRouter()
  const [country, setCountry] = useState(initialCountry)
  const [opts, setOpts] = useState<Opt[]>([])
  const [ship, setShip] = useState("")
  const [err, setErr] = useState("")
  const [loading, startLoad] = useTransition()
  const [paying, startPay] = useTransition()
  const [f, setF] = useState({ name: "", email: "", messenger: "", city: "", address: "" })

  useEffect(() => {
    startLoad(async () => {
      const o = await shippingOptionsFor(country)
      setOpts(o)
      setShip((s) => (o.some((x) => x.id === s) ? s : o[0]?.id ?? ""))
    })
  }, [country])
  useEffect(() => { track("checkout-start", { items: cart.count }) }, [cart.count])

  const names = useMemo(() => {
    try { return new Intl.DisplayNames([locale], { type: "region" }) } catch { return null }
  }, [locale])
  const cname = (c: { code: string; name: string }) => names?.of(c.code.toUpperCase()) ?? c.name
  const sorted = [...countries].sort((a, b) => cname(a).localeCompare(cname(b), locale))

  const opt = opts.find((o) => o.id === ship)
  const shipping = opt?.amount ?? 0
  const later = cart.lines.some((l) => l.mode === "mto" || l.mode === "mtm")
  const dueItems = cart.due - cart.shipping
  const total = cart.subtotal + shipping
  const due = dueItems + shipping
  const needsAddress = opt?.code !== "pickup"
  const fmt = (n: number) => money(n, cart.currency, locale)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr("")
    if (!f.name.trim() || !f.email.trim()) return setErr(t("needName"))
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return setErr(t("badEmail"))
    startPay(async () => {
      const res = await placeOrder({ ...f, country, shippingOptionId: ship })
      if (!res.ok) { setErr(res.error === "invalid" ? t("badEmail") : t("error")); return }
      track("order", { total: Math.round(total), currency: cart.currency })
      router.push(`/order/${res.orderId}?n=${res.displayId}`)
    })
  }

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="fld">
      <label htmlFor={`c-${k}`}>{label}</label>
      <input id={`c-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder=" " {...props} />
    </div>
  )

  return (
    <form className="co" onSubmit={submit} noValidate>
      <div>
        <fieldset>
          <legend className="u">{t("contact")}</legend>
          <div className="f2">
            {field("name", t("name"), { required: true, autoComplete: "name" })}
            {field("email", "Email", { required: true, type: "email", autoComplete: "email" })}
          </div>
          {field("messenger", t("messenger"), { placeholder: "@username / +995…" })}
        </fieldset>

        <fieldset>
          <legend className="u">{t("delivery")}</legend>
          {countries.length > 1 && (
            <div className="fld">
              <label htmlFor="c-country">{t("country")}</label>
              <select id="c-country" value={country} onChange={(e) => setCountry(e.target.value)}>
                {sorted.map((c) => <option key={c.code} value={c.code}>{cname(c)}</option>)}
              </select>
            </div>
          )}
          <div aria-busy={loading}>
            {opts.map((o) => {
              const keys = SHIP_KEYS[o.code]
              return (
                <label key={o.id} className="opt">
                  <input type="radio" name="ship" value={o.id} checked={ship === o.id} onChange={() => setShip(o.id)} />
                  <span>{keys ? t(keys[0]) : o.name}<small>{keys ? t(keys[1]) : ""}</small></span>
                  <span className="tn">{o.amount ? fmt(o.amount) : tc("free")}</span>
                </label>
              )
            })}
          </div>
          {needsAddress && (
            <div className="f2" style={{ marginTop: 12 }}>
              {field("city", t("city"))}
              {field("address", t("address"))}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="u">{t("payment")}</legend>
          <label className="opt"><input type="radio" name="pay" defaultChecked /><span>{t("card")}<small>{t("cardSub")}</small></span><span /></label>
          <p className="m" style={{ margin: "10px 0 0", maxWidth: "60ch" }}>{later ? t("depositPay") : t("fullPay")}</p>
        </fieldset>
        <button className="btn u" type="submit" disabled={paying || !ship}>{t("pay")} · {fmt(due)}</button>
        <p className="hint u" style={{ marginTop: 8 }}>{err}</p>
      </div>

      <aside className="summary">
        <div className="u">{t("order")}</div>
        {cart.lines.map((l) => (
          <div key={l.id} className="sline">
            {l.img ? <img src={l.img} alt="" /> : <span />}
            <div><div className="u">{l.title}</div><div className="m">{l.mode === "mtm" ? tm("mtm") : `${l.size} · ${tm(l.mode)}`}{l.qty > 1 ? ` · ×${l.qty}` : ""}</div></div>
            <span className="tn">{fmt(l.total)}</span>
          </div>
        ))}
        <div className="row"><span className="m">{t("items")}</span><span className="tn">{fmt(cart.subtotal)}</span></div>
        <div className="row"><span className="m">{tn("shipping")}</span><span className="tn">{shipping ? fmt(shipping) : tc("free")}</span></div>
        <div className="row total"><span className="u">{t("total")}</span><span className="tn">{fmt(total)}</span></div>
        {due < total && <div className="row" style={{ color: "var(--accent)" }}><span className="u">{t("dueNow")}</span><span className="tn">{fmt(due)}</span></div>}
      </aside>
    </form>
  )
}
