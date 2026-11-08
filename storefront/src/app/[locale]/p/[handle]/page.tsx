import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"
import { getProduct, listProducts } from "@/lib/data"
import { Gallery, ProductBuy } from "@/components/product-buy"
import { OpenSizes } from "@/components/chrome"
import { ProductCard } from "@/components/product-card"

type Params = { params: Promise<{ locale: Locale; handle: string }> }

export async function generateMetadata({ params }: Params) {
  const { locale, handle } = await params
  const p = await getProduct(locale, handle)
  return p ? { title: p.title, description: p.construction } : {}
}

export default async function Product({ params }: Params) {
  const { locale, handle } = await params
  setRequestLocale(locale)
  const p = await getProduct(locale, handle)
  if (!p) notFound()
  const t = await getTranslations()
  const related = (await listProducts(locale, { category: p.category })).filter((x) => x.id !== p.id).slice(0, 4)
  const ed = p.edition
  return (
    <div className="view">
      <div className="h u">
        <span><Link className="ln" href="/shop">{t("nav.shop")}</Link> / <Link className="ln" href={`/shop/${p.category}`}>{t(`cat.${p.category}`)}</Link></span>
        <span className="m tn">{p.sku}</span>
      </div>
      <hr className="rule" style={{ marginBottom: 14 }} />
      <div className="pdp">
        <Gallery images={p.images} alt={p.title} />
        <div className="info">
          <h1>{p.title}</h1>
          <ProductBuy p={p} />
          {ed && (
            <div className="serial u">
              <span>{ed.current ? t("product.piece", { a: String(ed.current).padStart(2, "0"), b: ed.total }) : t("product.edition", { b: ed.total })}</span>
              <span className="dots" aria-hidden="true">{Array.from({ length: ed.total }, (_, i) => <i key={i} className={i < ed.current ? "f" : ""} />)}</span>
            </div>
          )}
          <div className="acc">
            <details open><summary className="u">{t("product.construction")}<i>+</i></summary><div className="inner"><p>{p.construction}</p></div></details>
            <details><summary className="u">{t("product.material")}<i>+</i></summary><div className="inner"><p>{p.material}</p></div></details>
            <details><summary className="u">{t("product.fit")}<i>+</i></summary><div className="inner"><p>{t("product.fitText")} <OpenSizes className="ln">{t("product.sizeChart")}</OpenSizes></p></div></details>
            <details><summary className="u">{t("product.howMade")}<i>+</i></summary><div className="inner"><p>{t("product.videoText")} <a className="ln" href="https://www.instagram.com/samshit.sp/" target="_blank" rel="noopener">@samshit.sp</a></p></div></details>
            <details><summary className="u">{t("product.shippingReturns")}<i>+</i></summary><div className="inner"><p>{t("product.shippingText")}</p></div></details>
          </div>
          <Link className="u ask" href="/contact">{t("product.ask")}</Link>
        </div>
      </div>
      {!!related.length && (
        <>
          <hr className="rule" />
          <div className="h u"><span>{t("product.more")}</span></div>
          <div className="grid">{related.map((x, i) => <ProductCard key={x.id} p={x} i={i} />)}</div>
        </>
      )}
    </div>
  )
}
