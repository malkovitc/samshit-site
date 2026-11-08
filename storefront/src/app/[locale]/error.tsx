"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"

// Своя страница ошибки в айдентике сайта вместо стандартной Next.js.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common")
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="view done-box">
      <h1>{t("errorTitle")}</h1>
      <p className="m">{t("errorText")}</p>
      <p><button className="btn u" style={{ maxWidth: 260 }} onClick={() => reset()}>{t("reload")}</button></p>
    </div>
  )
}
