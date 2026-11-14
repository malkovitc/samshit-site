import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"
import { privateRobots } from "@/lib/seo"

export const metadata = { robots: privateRobots() }

// Ждём подтверждения банка: страница сама возвращается на checkout/return, пока счётчик не кончится
export default async function PaymentWait({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ cart?: string; n?: string; gone?: string }> }) {
  const [{ locale }, { cart, n, gone }] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const t = await getTranslations("checkout")
  const next = cart ? `/${locale}/checkout/return?cart=${encodeURIComponent(cart)}&n=${Number(n) || 1}` : ""
  return (
    <div className="view done-box">
      {next && <meta httpEquiv="refresh" content={`3;url=${next}`} />}
      <h1>{gone ? t("title") : t("waitTitle")}</h1>
      <p>{gone ? t("paidElsewhere") : t("waitText")}</p>
      {next && <p className="dots" aria-hidden="true"><span /><span /><span /></p>}
      <p><Link className="u ln" href="/shop">{t("back")}</Link></p>
    </div>
  )
}
