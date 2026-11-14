import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/routing"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const [nav, seo] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "seo" }),
  ])
  return pageMetadata(locale, "/about", nav("about"), seo("aboutDescription"))
}

export default async function About({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()
  return (
    <div className="view">
      <div className="h u"><h1>{t("nav.about")}</h1></div>
      <hr className="rule" style={{ marginBottom: 14 }} />
      <div className="story top">
        <div className="prose"><p>{t("about.p1")}</p><p>{t("about.p2")}</p><p>{t("about.p3")}</p></div>
        <span className="ph"><img src={"/static/p20.jpg"} alt={t("about.photoAlt")} /></span>
      </div>
    </div>
  )
}
