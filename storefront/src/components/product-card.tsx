import { getTranslations, getLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import type { ProductView } from "@/lib/data"
import { SIZES } from "@/lib/data"
import { money } from "@/lib/format"
import { QuickAdd } from "./quick-add"
import { WishlistButton } from "./account"
import { getWishlist } from "@/lib/session"

export async function StatusLabel({ p }: { p: ProductView }) {
  const t = await getTranslations("status")
  const locale = await getLocale()
  const text =
    p.status === "pre"
      ? t("pre", { d: new Date(p.preorderFrom!).toLocaleDateString(locale, { day: "numeric", month: "long" }) })
      : p.status === "stock" ? t("stock") : t("mto", { n: p.leadDays })
  return <span className={`st ${p.status}`}>{text}</span>
}

export async function ProductCard({ p, i }: { p: ProductView; i: number }) {
  const locale = await getLocale()
  const wished = (await getWishlist()).includes(p.handle)
  const quick =
    p.status === "stock"
      ? SIZES.map((s) => ({ label: s, variantId: p.variants[s], mode: "stock" as const, disabled: !p.stock[s] }))
      : [{ label: "M", variantId: p.variants.M, mode: p.status, disabled: false, wide: true }]
  return (
    <article className="card" style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}>
      <Link className="ph" href={`/p/${p.handle}`} aria-label={p.title}>
        <img className="a" src={p.images[0]} alt="" loading="lazy" />
        {p.images[1] && <img className="b" src={p.images[1]} alt="" loading="lazy" />}
      </Link>
      <WishlistButton handle={p.handle} inList={wished} compact />
      <div className="qwrap"><QuickAdd title={p.title} options={quick} /></div>
      <Link href={`/p/${p.handle}`} className="u name">{p.title}</Link>
      <div className="meta"><span className="m tn">{p.sku}</span><span className="tn">{money(p.price, p.currency, locale)}</span></div>
      <StatusLabel p={p} />
    </article>
  )
}
