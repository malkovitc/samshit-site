import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"
import { getMyOrder } from "@/lib/account-data"
import { money } from "@/lib/format"

export default async function OrderPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const order = await getMyOrder(locale, id)
  if (!order) notFound()
  const t = await getTranslations()
  return (
    <div className="view">
      <div className="h u"><span>{t("account.order", { n: order.displayId })}</span><Link className="ln m" href="/account">{t("account.back")}</Link></div>
      <hr className="rule" style={{ marginBottom: 16 }} />
      <div className="order-detail">
        <p className="m tn">
          {new Date(order.createdAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })} ·{" "}
          {order.status === "canceled" ? t("account.st_canceled") : t(`account.ff_${order.fulfillment}` as never)}
        </p>
        {order.lines.map((l, i) => (
          <div key={i} className="sline">
            {l.img ? <img src={l.img} alt="" /> : <span />}
            <div><Link className="u ln" href={`/p/${l.handle}`}>{l.title}</Link><div className="m">{l.mode === "mtm" ? t("mode.mtm") : `${l.size} · ${t(`mode.${l.mode}`)}`}{l.qty > 1 ? ` · ×${l.qty}` : ""}</div></div>
            <span className="tn">{money(l.total, order.currency, locale)}</span>
          </div>
        ))}
        <div className="row total"><span className="u">{t("checkout.total")}</span><span className="tn">{money(order.total, order.currency, locale)}</span></div>
      </div>
    </div>
  )
}
