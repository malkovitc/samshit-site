import { setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/routing"
import { ShopView } from "@/components/shop-view"

export default async function Shop({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ st?: string }> }) {
  const [{ locale }, { st }] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  return <ShopView locale={locale} st={st} />
}
