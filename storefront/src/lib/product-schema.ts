import type { Locale } from "../i18n/routing"
import type { ProductView } from "./data"
import { publicUrl, siteOrigin } from "./seo.ts"

type ProductForSchema = Pick<ProductView, "handle" | "title" | "construction" | "sku" | "images">

export function productSchema(product: ProductForSchema, locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.construction,
    url: publicUrl(locale, `/p/${product.handle}`),
    image: product.images.map((src) => new URL(src, siteOrigin()).href),
    sku: product.sku,
    brand: { "@type": "Brand", name: "Samshit" },
  }
}

export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}
