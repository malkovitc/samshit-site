import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/routing"
import { ShopView } from "@/components/shop-view"

const CATS = ["jackets", "trousers", "sweatshirts", "long-sleeves"]

export default async function Category({ params, searchParams }: { params: Promise<{ locale: Locale; category: string }>; searchParams: Promise<{ st?: string }> }) {
  const [{ locale, category }, { st }] = await Promise.all([params, searchParams])
  if (!CATS.includes(category)) notFound()
  setRequestLocale(locale)
  return <ShopView locale={locale} category={category} st={st} />
}
