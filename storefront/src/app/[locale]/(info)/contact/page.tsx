import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/routing"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const [nav, seo] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "seo" }),
  ])
  return pageMetadata(locale, "/contact", nav("contact"), seo("contactDescription"))
}

export default async function Contact({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()
  return (
    <div className="view">
      <div className="h u"><h1>{t("nav.contact")}</h1></div>
      <hr className="rule" style={{ marginBottom: 14 }} />
      <div className="prose">
        <p className="u">{t("contact.workshop")}</p><p>{t("contact.where")}</p>
        <p className="u">{t("contact.write")}</p>
        <p>{t("contact.phone")}<br />Instagram: <a className="ln" href="https://www.instagram.com/samshit.sp/" target="_blank" rel="noopener">@samshit.sp</a></p>
      </div>
    </div>
  )
}
