import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"

export default async function OrderDone({ params, searchParams }: { params: Promise<{ locale: Locale; id: string }>; searchParams: Promise<{ n?: string; paid?: string }> }) {
  const [{ locale }, { n, paid }] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const t = await getTranslations("checkout")
  return (
    <div className="view done-box">
      <svg className="tick" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M8 21l8 8 16-17" stroke="currentColor" strokeWidth="1.5" /></svg>
      <h1>{t("done", { n: n ? `#${n}` : "" })}</h1>
      <p>{t(paid ? "donePaid" : "doneManual")}</p>
      <p><Link className="u ln" href="/shop">{t("back")}</Link></p>
    </div>
  )
}
