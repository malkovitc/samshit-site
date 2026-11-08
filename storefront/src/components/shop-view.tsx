import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"
import { listProducts } from "@/lib/data"
import { ProductCard } from "./product-card"

const ST = ["all", "stock", "mto", "pre"] as const
type St = (typeof ST)[number]

export async function ShopView({ locale, category, st }: { locale: Locale; category?: string; st?: string }) {
  const t = await getTranslations()
  const filter: St = ST.includes(st as St) ? (st as St) : "all"
  const all = await listProducts(locale, { category })
  const list = all.filter((p) => filter === "all" || p.status === filter)
  const base = category ? `/shop/${category}` : "/shop"
  const label: Record<St, string> = { all: t("cat.all"), stock: t("status.stock"), mto: t("status.mtoShort"), pre: t("status.preShort") }
  return (
    <div className="view">
      <div className="h u"><span>{category ? t(`cat.${category}`) : t("home.allPieces")}</span><span className="m tagline">{t("shop.handmade")}</span></div>
      <hr className="rule" />
      <div className="filters" style={{ paddingTop: 10 }}>
        {ST.map((k) => {
          const n = all.filter((p) => k === "all" || p.status === k).length
          return (
            <Link key={k} className="u" href={k === "all" ? base : `${base}?st=${k}`} aria-current={filter === k ? "true" : undefined} scroll={false}>
              {label[k]} · <span className="tn">{n}</span>
            </Link>
          )
        })}
      </div>
      <div className="grid">
        {list.length ? list.map((p, i) => <ProductCard key={p.id} p={p} i={i} />) : (
          <p className="m">{t("shop.empty")} <Link className="ln" href="/shop">{t("shop.seeAll")}</Link></p>
        )}
      </div>
    </div>
  )
}
