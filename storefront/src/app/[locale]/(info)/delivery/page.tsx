import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/routing"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const [nav, seo] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "seo" }),
  ])
  return pageMetadata(locale, "/delivery", nav("delivery"), seo("deliveryDescription"))
}

export default async function Delivery({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()
  return (
    <div className="view">
      <div className="h u"><h1>{t("nav.delivery")}</h1></div>
      <hr className="rule" style={{ marginBottom: 14 }} />
      <div className="prose">
        <p className="u">{t("delivery.tbilisi")}</p><p>{t("delivery.p1")}</p>
        <p className="u">{t("delivery.world")}</p><p>{t("delivery.p2")}</p>
        <p className="u">{t("delivery.times")}</p><p>{t("delivery.p3")}</p>
        <p className="u">{t("delivery.returns")}</p><p>{t("delivery.p4")}</p>
        <p className="m">{t("delivery.note")}</p>
      </div>
    </div>
  )
}
