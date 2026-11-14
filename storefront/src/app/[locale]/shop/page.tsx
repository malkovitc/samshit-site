import { setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/routing"
import { ShopView } from "@/components/shop-view"
import { getTranslations } from "next-intl/server"
import { pageMetadata, privateRobots } from "@/lib/seo"

export async function generateMetadata({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ st?: string }> }) {
  const [{ locale }, { st }] = await Promise.all([params, searchParams])
  const [nav, seo] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "seo" }),
  ])
  return { ...pageMetadata(locale, "/shop", nav("shop"), seo("shopDescription")), ...(st ? { robots: privateRobots() } : {}) }
}

export default async function Shop({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ st?: string }> }) {
  const [{ locale }, { st }] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  return <ShopView locale={locale} st={st} />
}
