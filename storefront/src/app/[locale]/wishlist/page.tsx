import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"
import { listProducts } from "@/lib/data"
import { getCustomer, getWishlist } from "@/lib/session"
import { ProductCard } from "@/components/product-card"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "wishlist" })
  return { title: t("title") }
}

export default async function Wishlist({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("wishlist")
  const tn = await getTranslations("nav")
  const customer = await getCustomer()
  const handles = await getWishlist(customer)
  const all = await listProducts(locale)
  const items = handles.map((h) => all.find((p) => p.handle === h)).filter((p) => !!p)
  return (
    <div className="view">
      <div className="h u"><span>{t("title")} · <span className="tn">{items.length}</span></span>{!customer && <Link className="ln m" href="/account">{tn("signIn")}</Link>}</div>
      <hr className="rule" />
      {!customer && items.length > 0 && <p className="m" style={{ marginTop: 10 }}>{t("guestNote")}</p>}
      {items.length ? (
        <div className="grid">{items.map((p, i) => <ProductCard key={p.id} p={p} i={i} />)}</div>
      ) : (
        <p className="m" style={{ marginTop: 16 }}>{t("empty")} <Link className="ln" href="/shop">{tn("shop")}</Link></p>
      )}
    </div>
  )
}
