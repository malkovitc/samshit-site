import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"
import { getCustomer } from "@/lib/session"
import { listMyOrders } from "@/lib/account-data"
import { money } from "@/lib/format"
import { ProfileForm, RegisterForm, SignInForm, SignOutButton } from "@/components/account"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "nav" })
  return { title: t("account") }
}

export default async function Account({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("account")
  const tn = await getTranslations("nav")
  const customer = await getCustomer()

  if (!customer) {
    return (
      <div className="view">
        <div className="h u"><span>{tn("account")}</span></div>
        <hr className="rule" style={{ marginBottom: 20 }} />
        <div className="auth-grid"><SignInForm /><RegisterForm /></div>
      </div>
    )
  }

  const orders = await listMyOrders(locale)
  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ")
  return (
    <div className="view">
      <div className="h u"><span>{t("hello", { name: customer.first_name || customer.email })}</span><SignOutButton /></div>
      <hr className="rule" style={{ marginBottom: 20 }} />
      <div className="account">
        <section>
          <h2 className="u sec">{t("orders")}</h2>
          {!orders.length && <p className="m">{t("noOrders")} <Link className="ln" href="/shop">{tn("shop")}</Link></p>}
          {orders.map((o) => (
            <Link key={o.id} href={`/account/orders/${o.id}`} className="order-row">
              <span className="u">{t("order", { n: o.displayId })}</span>
              <span className="m tn">{new Date(o.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}</span>
              <span className={`st${o.status === "canceled" ? "" : " mto"}`}>{o.status === "canceled" ? t("st_canceled") : t(`ff_${o.fulfillment}` as never)}</span>
              <span className="tn">{money(o.total, o.currency, locale)}</span>
              <span className="thumbs-row">{o.lines.slice(0, 4).map((l, i) => l.img ? <img key={i} src={l.img} alt="" /> : null)}</span>
            </Link>
          ))}
        </section>
        <aside>
          <h2 className="u sec">{t("profile")}</h2>
          <p className="m tn" style={{ margin: "0 0 12px" }}>{customer.email}</p>
          <ProfileForm name={name} messenger={customer.metadata?.messenger ?? ""} />
          <h2 className="u sec" style={{ marginTop: 32 }}><Link className="ln" href="/wishlist">{tn("wishlist")} · {(customer.metadata?.wishlist ?? []).length} →</Link></h2>
        </aside>
      </div>
    </div>
  )
}
