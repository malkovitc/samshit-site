import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"
import { getCart } from "@/lib/data"
import { cartView } from "@/lib/cart-view"
import { CheckoutForm } from "@/components/checkout-form"

export default async function Checkout({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("checkout")
  const cart = await getCart()
  const view = cartView(cart, locale)
  if (!cart || !view?.lines.length) {
    return (
      <div className="view done-box">
        <h1>{t("emptyTitle")}</h1>
        <p className="m">{t("emptyText")}</p>
        <p><Link className="u ln" href="/shop">{t("back")}</Link></p>
      </div>
    )
  }
  const countries = (cart.region?.countries ?? []).map((c) => ({ code: c.iso_2!, name: c.display_name ?? c.name ?? c.iso_2! }))
  return (
    <div className="view">
      <div className="h u"><span>{t("title")}</span><Link className="ln m" href="/shop">{t("back")}</Link></div>
      <hr className="rule" style={{ marginBottom: 16 }} />
      <CheckoutForm cart={view} countries={countries} initialCountry={cart.shipping_address?.country_code ?? countries[0]?.code ?? ""} />
    </div>
  )
}
