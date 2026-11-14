import type { MetadataRoute } from "next"
import type { Locale } from "../i18n/routing"
import { publicUrl } from "./seo.ts"
import { CATALOG_CATEGORIES } from "./catalog-list.ts"

const LOCALES: Locale[] = ["ru", "en", "ka"]
const INFO = ["/about", "/workshop", "/delivery", "/contact"]

type SitemapProduct = { handle: string; category: string; updatedAt?: string }

export function sitemapEntries(products: SitemapProduct[], enabled: boolean): MetadataRoute.Sitemap {
  if (!enabled) return []
  const categories = [...new Set(products.map((p) => p.category).filter((category) => CATALOG_CATEGORIES.some((allowed) => allowed === category)))].sort()
  const paths = ["", "/shop", ...categories.map((category) => `/shop/${category}`), ...INFO]
  const entries: MetadataRoute.Sitemap = []
  for (const path of paths) {
    for (const locale of LOCALES) {
      entries.push({
        url: publicUrl(locale, path),
        alternates: { languages: Object.fromEntries([
          ...LOCALES.map((language) => [language, publicUrl(language, path)]),
          ["x-default", publicUrl("en", path)],
        ]) },
      })
    }
  }
  for (const product of products) {
    const path = `/p/${product.handle}`
    for (const locale of LOCALES) {
      entries.push({
        url: publicUrl(locale, path),
        lastModified: product.updatedAt ? new Date(product.updatedAt) : undefined,
        alternates: { languages: Object.fromEntries([
          ...LOCALES.map((language) => [language, publicUrl(language, path)]),
          ["x-default", publicUrl("en", path)],
        ]) },
      })
    }
  }
  return entries
}
