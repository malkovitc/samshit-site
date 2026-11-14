import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"
import { privateRobots } from "@/lib/seo"

export const metadata = { robots: privateRobots() }
import { ForgotForm } from "@/components/account"

export default async function ForgotPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("account")
  return (
    <div className="view done-box">
      <h1>{t("forgotTitle")}</h1>
      <ForgotForm />
      <p><Link className="u ln" href="/account">{t("signInTitle")}</Link></p>
    </div>
  )
}
