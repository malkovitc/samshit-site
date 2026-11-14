import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/routing"
import { privateRobots } from "@/lib/seo"

export const metadata = { robots: privateRobots() }
import { Unsubscribe } from "@/components/account"

// Отписка по ссылке из письма. Нужен клик: почтовые сканеры открывают ссылки сами и не должны отписывать.
export default async function UnsubscribePage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ token?: string }> }) {
  const [{ locale }, { token }] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const t = await getTranslations("newsletter")
  return (
    <div className="view done-box">
      <h1>{t("unsubAsk")}</h1>
      <Unsubscribe token={token ?? ""} />
    </div>
  )
}
