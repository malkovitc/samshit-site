"use client"

import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { setCurrency, setQuantity } from "@/lib/actions"
import { subscribeNewsletter } from "@/lib/account-actions"
import { money } from "@/lib/format"
import type { CartView } from "@/lib/cart-view"
import { track } from "./analytics"

/* ---------- состояние интерфейса ---------- */
type Ui = {
  cartOpen: boolean; setCartOpen: (v: boolean) => void
  sizesOpen: boolean; setSizesOpen: (v: boolean) => void
  menuOpen: boolean; setMenuOpen: (v: boolean) => void
  toast: (s: string) => void
}
const UiCtx = createContext<Ui | null>(null)
export const useUi = () => {
  const ui = useContext(UiCtx)
  if (!ui) throw new Error("useUi outside UiProvider")
  return ui
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false)
  const [sizesOpen, setSizesOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [msg, setMsg] = useState("")
  const [shown, setShown] = useState(false)
  const pathname = usePathname()
  useEffect(() => { setCartOpen(false); setSizesOpen(false); setMenuOpen(false) }, [pathname])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setCartOpen(false); setSizesOpen(false); setMenuOpen(false) } }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  useEffect(() => { if (!shown) return; const t = setTimeout(() => setShown(false), 2200); return () => clearTimeout(t) }, [shown, msg])
  const toast = (s: string) => { setMsg(s); setShown(true) }
  return (
    <UiCtx.Provider value={{ cartOpen, setCartOpen, sizesOpen, setSizesOpen, menuOpen, setMenuOpen, toast }}>
      {children}
      <div className={`scrim${cartOpen || sizesOpen ? " open" : ""}`} onClick={() => { setCartOpen(false); setSizesOpen(false) }} />
      <div className={`toast u${shown ? " show" : ""}`} role="status">{msg}</div>
    </UiCtx.Provider>
  )
}

export function Sprig() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M12.6 23c-.3-3.4-.7-6.6-1.6-9.4C8.6 13.9 6.1 12.6 5 10.1c2.4-.6 4.8.4 5.9 2.3-.4-2.2-.2-4.5.9-6.7C10 4.6 9.2 2.6 9.8.8c1.9 1 3 3 2.6 5 1.3-1.3 3.3-1.8 5.2-1.2-.6 2-2.5 3.3-4.6 3.3-.6 1.6-.7 3.3-.4 5 1-1.4 2.8-2.1 4.6-1.8-.4 1.9-2.1 3.3-4.1 3.4.6 2.6.9 5.3 1.1 8.5z"/></svg>
}

/* ---------- язык и валюта ---------- */
const LANGS = [["ru", "RU"], ["en", "EN"], ["ka", "GE"]] as const
const CURS = [["usd", "USD"], ["gel", "GEL"], ["eur", "EUR"]] as const

function Switches({ currency, className }: { currency: string; className?: string }) {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <>
      <div className={`cur ${className ?? ""}`} role="group" aria-label="Language">
        {LANGS.map(([l, label]) => (
          <button key={l} aria-pressed={l === locale} onClick={() => { track("lang", { lang: l }); router.replace(pathname, { locale: l }) }}>{label}</button>
        ))}
      </div>
      <div className={`cur ${className ?? ""}`} role="group" aria-label="Currency" aria-busy={pending}>
        {CURS.map(([c, label]) => (
          <button key={c} aria-pressed={c === currency} onClick={() => start(async () => { await setCurrency(c); router.refresh() })}>{label}</button>
        ))}
      </div>
    </>
  )
}

/* ---------- шапка ---------- */
export function Header({ currency, count, signedIn, wishCount }: { currency: string; count: number; signedIn: boolean; wishCount: number }) {
  const t = useTranslations()
  const ui = useUi()
  const [bump, setBump] = useState(false)
  const [prev, setPrev] = useState(count)
  if (count !== prev) { setPrev(count); if (count > prev) setBump(true) }
  return (
    <>
      <div className="notice u"><span>{t("notice.world")}</span><span>{t("notice.tbilisi")}</span></div>
      <header>
        <Link className="logo u" href="/"><Sprig />{t("brand.name")}</Link>
        <div className="hr u">
          <Switches currency={currency} />
          <Link className="ln hide-mob" href="/wishlist" aria-label={t("nav.wishlist")}>♡ <span className="tn">{wishCount}</span></Link>
          <Link className="ln hide-mob" href="/account">{signedIn ? t("nav.account") : t("nav.signIn")}</Link>
          <button className="ln" onClick={() => { ui.setCartOpen(true); track("open-cart") }}>
            {t("nav.bag")} — <span className={`count tn${bump ? " bump" : ""}`} onAnimationEnd={() => setBump(false)}>{count}</span>
          </button>
          <button className="burger" aria-expanded={ui.menuOpen} onClick={() => ui.setMenuOpen(!ui.menuOpen)}>{t("nav.menu")}</button>
        </div>
      </header>
    </>
  )
}

/* ---------- меню слева ---------- */
const CATS = ["jackets", "trousers", "sweatshirts", "long-sleeves"] as const
export function SideNav({ currency, signedIn, wishCount }: { currency: string; signedIn: boolean; wishCount: number }) {
  const t = useTranslations()
  const ui = useUi()
  const pathname = usePathname()
  const inShop = pathname.startsWith("/shop") || pathname.startsWith("/p/")
  const cur = (href: string) => (pathname === href || (href === "/shop" && inShop) ? "page" : undefined)
  return (
    <nav className={`side u${ui.menuOpen ? " open" : ""}`}>
      <div className="mob-only"><Switches currency={currency} /></div>
      <Link className="ln" href="/shop" aria-current={cur("/shop")}>{t("nav.shop")}</Link>
      <div className={`sub${inShop ? " open" : ""}`}>
        <Link className="ln" href="/shop" aria-current={pathname === "/shop" ? "page" : undefined}>{t("cat.all")}</Link>
        {CATS.map((c) => <Link key={c} className="ln" href={`/shop/${c}`} aria-current={pathname === `/shop/${c}` ? "page" : undefined}>{t(`cat.${c}`)}</Link>)}
      </div>
      <Link className="ln" href="/workshop" aria-current={cur("/workshop")}>{t("nav.workshop")}</Link>
      <Link className="ln" href="/about" aria-current={cur("/about")}>{t("nav.about")}</Link>
      <div className="sep" />
      <button className="ln" onClick={() => ui.setSizesOpen(true)}>{t("nav.sizes")}</button>
      <Link className="ln" href="/delivery" aria-current={cur("/delivery")}>{t("nav.delivery")}</Link>
      <Link className="ln" href="/contact" aria-current={cur("/contact")}>{t("nav.contact")}</Link>
      <div className="sep" />
      <Link className="ln" href="/wishlist" aria-current={cur("/wishlist")}>{t("nav.wishlist")} · <span className="tn">{wishCount}</span></Link>
      <Link className="ln" href="/account" aria-current={pathname.startsWith("/account") ? "page" : undefined}>{signedIn ? t("nav.account") : t("nav.signIn")}</Link>
    </nav>
  )
}

/* ---------- корзина ---------- */
export function CartDrawer({ cart }: { cart: CartView | null }) {
  const t = useTranslations()
  const locale = useLocale()
  const ui = useUi()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [leaving, setLeaving] = useState<string | null>(null)
  const change = (id: string, q: number) => {
    if (q <= 0) setLeaving(id)
    start(async () => { await setQuantity(id, q); setLeaving(null); router.refresh() })
  }
  const lines = cart?.lines ?? []
  const later = lines.some((l) => l.mode === "mto" || l.mode === "mtm")
  return (
    <aside className={`drawer${ui.cartOpen ? " open" : ""}`} aria-hidden={!ui.cartOpen} aria-busy={pending}>
      <div className="top u"><span>{t("nav.bag")}</span><button className="ln" onClick={() => ui.setCartOpen(false)}>{t("common.close")}</button></div>
      <div className="lines">
        {!lines.length && <div className="empty">{t("cart.empty")}<br /><Link className="ln u" href="/shop">{t("cart.goShop")}</Link></div>}
        {lines.map((l) => (
          <div key={l.id} className={`line${leaving === l.id ? " out" : ""}`}>
            <Link href={`/p/${l.handle}`}>{l.img && <img src={l.img} alt="" />}</Link>
            <div>
              <div className="u">{l.title}</div>
              <div className="m">{l.mode === "mtm" ? t("mode.mtm") : `${l.size} · ${t(`mode.${l.mode}`)}`}</div>
              <div className="qty"><button onClick={() => change(l.id, l.qty - 1)} aria-label="−">−</button><span className="tn">{l.qty}</span><button onClick={() => change(l.id, l.qty + 1)} aria-label="+">+</button></div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="tn">{money(l.total, cart!.currency, locale)}</div>
              <button className="ln m u" style={{ marginTop: 8 }} onClick={() => change(l.id, 0)}>{t("cart.remove")}</button>
            </div>
          </div>
        ))}
      </div>
      {!!lines.length && cart && (
        <div className="sum">
          <div className="row"><span className="u">{t("cart.subtotal")}</span><span className="tn">{money(cart.subtotal, cart.currency, locale)}</span></div>
          <div className="m">{later ? t("cart.depositNote") : ""}{t("cart.shipNote")}</div>
          <Link className="btn u" href="/checkout">{t("cart.checkout")}</Link>
          <button className="btn ghost u" onClick={() => ui.setCartOpen(false)}>{t("cart.continue")}</button>
        </div>
      )}
    </aside>
  )
}

/* ---------- таблица размеров ---------- */
const CHART = [["S", 124, 66, 58, "165–175"], ["M", 130, 68, 60, "172–182"], ["L", 136, 70, 62, "178–188"], ["XL", 142, 72, 63, "185–195"]] as const
export function SizesModal() {
  const t = useTranslations("sizes")
  const tc = useTranslations("common")
  const ui = useUi()
  return (
    <div className={`modal${ui.sizesOpen ? " open" : ""}`} role="dialog" aria-modal="true" aria-labelledby="szT" onClick={(e) => { if (e.target === e.currentTarget) ui.setSizesOpen(false) }}>
      <div className="box">
        <div className="h u" style={{ borderBottom: "1px solid var(--line)", marginBottom: 10 }}><span id="szT">{t("title")}</span><button className="ln" onClick={() => ui.setSizesOpen(false)}>{tc("close")}</button></div>
        <table className="tn"><tbody>
          <tr className="u m"><th>{t("size")}</th><th>{t("chest")}</th><th>{t("length")}</th><th>{t("sleeve")}</th><th>{t("height")}</th></tr>
          {CHART.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}
        </tbody></table>
        <p className="m" style={{ margin: "12px 0 0" }}>{t("note")}</p>
      </div>
    </div>
  )
}

export function OpenSizes({ children, className }: { children: ReactNode; className?: string }) {
  const ui = useUi()
  return <button className={className} onClick={() => ui.setSizesOpen(true)}>{children}</button>
}

/* ---------- шрифт ---------- */
const FONTS = [["source", "Source Code Pro"], ["lilex", "Lilex"], ["iosevka", "Iosevka Charon"], ["jetbrains", "JetBrains Mono"]] as const
export function FontTweak() {
  const t = useTranslations("common")
  const [font, setFont] = useState("source")
  // панель сравнения шрифтов — инструмент для владельца: видна только по ?fonts
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    setVisible(new URLSearchParams(window.location.search).has("fonts"))
    try { const f = localStorage.getItem("samshit-font"); if (f) setFont(f) } catch {}
  }, [])
  useEffect(() => {
    document.documentElement.dataset.font = font
    try { localStorage.setItem("samshit-font", font) } catch {}
  }, [font])
  return (
    <div className="tweak u" role="group" aria-label="Font" hidden={!visible}>
      <span className="m">{t("font")}</span>
      {FONTS.map(([k, n]) => <button key={k} aria-pressed={font === k} onClick={() => setFont(k)}>{n}</button>)}
    </div>
  )
}

/* ---------- подписка ---------- */
export function Subscribe() {
  const t = useTranslations("footer")
  const tn = useTranslations("newsletter")
  const locale = useLocale()
  const ui = useUi()
  const [email, setEmail] = useState("")
  const [pending, start] = useTransition()
  return (
    <form
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await subscribeNewsletter(email, locale)
          if (!r.ok) return ui.toast(tn("error"))
          track("subscribe", { source: "footer" })
          ui.toast(t("subscribed"))
          setEmail("")
        })
      }}
    >
      <input id="subEmail" type="email" required placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="ln" type="submit">{t("subscribe")}</button>
    </form>
  )
}
