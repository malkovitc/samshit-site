import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/routing"
import { ShopView } from "@/components/shop-view"
import { pageMetadata, privateRobots } from "@/lib/seo"
import { CATALOG_CATEGORIES } from "@/lib/catalog-list"

const CATS: readonly string[] = CATALOG_CATEGORIES

export async function generateMetadata({ params, searchParams }: { params: Promise<{ locale: Locale; category: string }>; searchParams: Promise<{ st?: string }> }) {
  const [{ locale, category }, { st }] = await Promise.all([params, searchParams])
  if (!CATS.includes(category)) notFound()
  const [cat, seo] = await Promise.all([
    getTranslations({ locale, namespace: "cat" }),
    getTranslations({ locale, namespace: "seo" }),
  ])
  const title = cat(category as "jackets")
  return { ...pageMetadata(locale, `/shop/${category}`, title, seo("categoryDescription", { category: title })), ...(st ? { robots: privateRobots() } : {}) }
}

export default async function Category({ params, searchParams }: { params: Promise<{ locale: Locale; category: string }>; searchParams: Promise<{ st?: string }> }) {
  const [{ locale, category }, { st }] = await Promise.all([params, searchParams])
  if (!CATS.includes(category)) notFound()
  setRequestLocale(locale)
  return <ShopView locale={locale} category={category} st={st} />
}
