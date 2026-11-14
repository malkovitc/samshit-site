import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/routing"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const [nav, seo] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "seo" }),
  ])
  return pageMetadata(locale, "/workshop", nav("workshop"), seo("workshopDescription"))
}

const ITEMS = [["p23", "j1"], ["p01", "j2"], ["p14", "j3"], ["p12", "j4"], ["p21", "j5"], ["p19", "j6"]] as const

export default async function Workshop({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()
  return (
    <div className="view">
      <div className="h u"><h1>{t("nav.workshop")}</h1><span className="m">{t("workshop.journal")}</span></div>
      <hr className="rule" style={{ marginBottom: 14 }} />
      <div className="journal">
        {ITEMS.map(([img, k], i) => (
          <div key={k} className="card" style={{ animationDelay: `${i * 60}ms` }}>
            <span className="ph"><img src={`/static/${img}.jpg`} alt="" loading="lazy" /></span>
            <span className="u">{t(`workshop.${k}`)}</span>
            <span className="m">{t(`workshop.${k}s`)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
