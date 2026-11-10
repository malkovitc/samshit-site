import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"
import { ResetForm } from "@/components/account"

// Ссылка из письма о смене пароля: токен Medusa действует 15 минут
export default async function ResetPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ token?: string; email?: string }> }) {
  const [{ locale }, { token, email }] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const t = await getTranslations("account")
  return (
    <div className="view done-box">
      {/* токен в адресе не должен уходить в Referer сторонним ресурсам */}
      <meta name="referrer" content="no-referrer" />
      <h1>{t("resetTitle")}</h1>
      {token && email ? <ResetForm token={token} email={email} /> : <p className="m">{t("resetMissing")}</p>}
      <p><Link className="u ln" href="/account/forgot">{t("forgotTitle")}</Link></p>
    </div>
  )
}
