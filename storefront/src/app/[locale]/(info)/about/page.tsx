import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/routing"

export default async function About({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()
  return (
    <div className="view">
      <div className="h u"><span>{t("nav.about")}</span></div>
      <hr className="rule" style={{ marginBottom: 14 }} />
      <div className="story top">
        <div className="prose"><p>{t("about.p1")}</p><p>{t("about.p2")}</p><p>{t("about.p3")}</p></div>
        <span className="ph"><img src={"/static/p20.jpg"} alt={t("about.photoAlt")} /></span>
      </div>
    </div>
  )
}
