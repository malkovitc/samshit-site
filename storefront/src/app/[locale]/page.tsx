import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"
import { listProducts } from "@/lib/data"
import { newestProducts } from "@/lib/catalog-list"
import { ProductCard } from "@/components/product-card"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "seo" })
  return pageMetadata(locale, "", t("homeTitle"), t("homeDescription"))
}

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("home")
  const all = await listProducts(locale)
  const fresh = newestProducts(all)
  const heroImg = all.find((p) => p.handle === "shield-white")?.images[1]
  const storyImg = all.find((p) => p.handle === "shield-indigo")?.images[2]
  return (
    <div className="view">
      <Link className="hero" href="/shop">
        <div className="frame">{heroImg && <img src={heroImg} alt="" />}</div>
        <div className="hero-cap u"><h1>{t("heroTitle")}</h1><span>{t("view")} <span className="arrow">→</span></span></div>
      </Link>
      <div className="h u" style={{ marginTop: 36 }}><span>{t("new")}</span><Link className="ln" href="/shop">{t("allPieces")}</Link></div>
      <hr className="rule" />
      <div className="grid">{fresh.map((p, i) => <ProductCard key={p.id} p={p} i={i} />)}</div>
      <hr className="rule" />
      <div className="story">
        <div><div className="u m" style={{ marginBottom: 10 }}>{t("fromWorkshop")}</div><p>{t("story")}</p><Link className="u ln" href="/workshop">{t("howMade")}</Link></div>
        <Link className="ph" href="/workshop" style={{ aspectRatio: "4/3" }}>{storyImg && <img src={storyImg} alt="" />}</Link>
      </div>
    </div>
  )
}
