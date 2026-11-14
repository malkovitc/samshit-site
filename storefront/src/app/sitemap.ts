import type { MetadataRoute } from "next"
import { listProducts } from "@/lib/data"
import { indexingEnabled } from "@/lib/seo"
import { sitemapEntries } from "@/lib/seo-sitemap"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexingEnabled()) return []
  const products = await listProducts("en")
  return sitemapEntries(products, true)
}
