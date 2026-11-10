"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/navigation"
import { register, requestPasswordReset, resetPassword, signIn, signOut, toggleWishlist, unsubscribeNewsletter, updateProfile } from "@/lib/account-actions"
import { useUi, useSafeTransition } from "./chrome"
import { track } from "./analytics"

function Field({ id, label, hint, ...props }: { id: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="fld">
      <label htmlFor={id}>{label}</label>
      <input id={id} placeholder=" " {...props} />
      {hint && <small className="m">{hint}</small>}
    </div>
  )
}

export function SignInForm() {
  const t = useTranslations("account")
  const router = useRouter()
  const [err, setErr] = useState("")
  const [pending, start] = useSafeTransition()
  return (
    <form
      className="auth"
      onSubmit={(e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        setErr("")
        start(async () => {
          const r = await signIn({ email: String(f.get("email")), password: String(f.get("password")) })
          if (!r.ok) return setErr(t(r.error === "invalid" ? "errInvalid" : "errCredentials"))
          track("sign-in")
          router.refresh()
        })
      }}
    >
      <h2 className="u">{t("signInTitle")}</h2>
      <Field id="si-email" name="email" label="Email" type="email" autoComplete="email" required />
      <Field id="si-password" name="password" label={t("password")} type="password" autoComplete="current-password" required />
      <button className="btn u" disabled={pending}>{t("signInBtn")}</button>
      <p className="hint u">{err}</p>
      <p className="m small"><Link className="ln" href="/account/forgot">{t("forgot")}</Link></p>
    </form>
  )
}

export function RegisterForm() {
  const t = useTranslations("account")
  const locale = useLocale()
  const router = useRouter()
  const [err, setErr] = useState("")
  const [pending, start] = useSafeTransition()
  return (
    <form
      className="auth"
      onSubmit={(e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        setErr("")
        start(async () => {
          const r = await register({
            name: String(f.get("name")), email: String(f.get("email")), password: String(f.get("password")),
            newsletter: f.get("newsletter") === "on", locale,
          })
          if (!r.ok) return setErr(t({ invalid: "errInvalid", short: "errShort", exists: "errExists", failed: "errFailed" }[r.error]))
          track("sign-up", { newsletter: f.get("newsletter") === "on" ? 1 : 0 })
          router.refresh()
        })
      }}
    >
      <h2 className="u">{t("registerTitle")}</h2>
      <p className="m">{t("registerNote")}</p>
      <Field id="re-name" name="name" label={t("name")} autoComplete="name" required />
      <Field id="re-email" name="email" label="Email" type="email" autoComplete="email" required />
      <Field id="re-password" name="password" label={t("password")} hint={t("passwordHint")} type="password" autoComplete="new-password" minLength={8} required />
      <label className="check"><input type="checkbox" name="newsletter" defaultChecked /><span>{t("newsletter")}</span></label>
      <button className="btn u" disabled={pending}>{t("registerBtn")}</button>
      <p className="hint u">{err}</p>
    </form>
  )
}

export function ProfileForm({ name, messenger }: { name: string; messenger: string }) {
  const t = useTranslations("account")
  const tc = useTranslations("checkout")
  const ui = useUi()
  const [pending, start] = useSafeTransition()
  return (
    <form
      className="auth"
      onSubmit={(e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        start(async () => {
          const r = await updateProfile({ name: String(f.get("name")), messenger: String(f.get("messenger")) })
          if (r.ok) ui.toast(t("saved"))
        })
      }}
    >
      <Field id="pr-name" name="name" label={t("name")} defaultValue={name} required />
      <Field id="pr-messenger" name="messenger" label={tc("messenger")} defaultValue={messenger} placeholder="@username / +995…" />
      <button className="btn ghost u" disabled={pending}>{t("save")}</button>
    </form>
  )
}

export function SignOutButton() {
  const t = useTranslations("account")
  const router = useRouter()
  const [pending, start] = useSafeTransition()
  return <button className="ln u m" disabled={pending} onClick={() => start(async () => { await signOut(); router.refresh() })}>{t("signOut")}</button>
}

export function WishlistButton({ handle, inList, compact }: { handle: string; inList: boolean; compact?: boolean }) {
  const t = useTranslations("wishlist")
  const router = useRouter()
  const [on, setOn] = useState(inList)
  const [pending, start] = useSafeTransition()
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOn(!on) // сразу, без ожидания сервера
    start(async () => {
      const r = await toggleWishlist(handle)
      setOn(r.inList)
      track(r.inList ? "wishlist-add" : "wishlist-remove", { product: handle })
      router.refresh()
    })
  }
  const label = on ? t("remove") : t("add")
  return compact ? (
    <button className={`heart${on ? " on" : ""}`} aria-pressed={on} aria-label={label} title={label} onClick={toggle} disabled={pending}>
      {on ? "♥" : "♡"}
    </button>
  ) : (
    <button className={`wish u${on ? " on" : ""}`} aria-pressed={on} onClick={toggle} disabled={pending}>
      <span aria-hidden="true">{on ? "♥" : "♡"}</span> {label}
    </button>
  )
}

export function Unsubscribe({ token }: { token: string }) {
  const t = useTranslations("newsletter")
  const [state, setState] = useState<"idle" | "done" | "bad">("idle")
  const [pending, start] = useSafeTransition()
  if (state !== "idle") return <p>{t(state === "done" ? "unsubText" : "unsubBad")}</p>
  return (
    <button className="btn u" style={{ maxWidth: 320 }} disabled={pending || !token}
      onClick={() => start(async () => setState((await unsubscribeNewsletter(token)).ok ? "done" : "bad"))}>
      {t("unsubBtn")}
    </button>
  )
}

export function ForgotForm() {
  const t = useTranslations("account")
  const locale = useLocale()
  const [sent, setSent] = useState(false)
  const [pending, start] = useSafeTransition()
  if (sent) return <p className="m">{t("forgotSent")}</p>
  return (
    <form
      className="auth"
      onSubmit={(e) => {
        e.preventDefault()
        const email = String(new FormData(e.currentTarget).get("email"))
        start(async () => {
          if ((await requestPasswordReset(email, locale)).ok) setSent(true)
        })
      }}
    >
      <p className="m">{t("forgotText")}</p>
      <Field id="fg-email" name="email" label="Email" type="email" autoComplete="email" required />
      <button className="btn u" disabled={pending}>{t("forgotBtn")}</button>
    </form>
  )
}

export function ResetForm({ token, email }: { token: string; email: string }) {
  const t = useTranslations("account")
  const router = useRouter()
  const [err, setErr] = useState("")
  const [pending, start] = useSafeTransition()
  return (
    <form
      className="auth"
      onSubmit={(e) => {
        e.preventDefault()
        const password = String(new FormData(e.currentTarget).get("password"))
        setErr("")
        start(async () => {
          const r = await resetPassword({ token, email, password })
          if (!r.ok) return setErr(t(r.error === "short" ? "errShort" : "resetExpired"))
          track("password-reset")
          router.push("/account")
        })
      }}
    >
      <p className="m">{email}</p>
      <Field id="rs-password" name="password" label={t("newPassword")} hint={t("passwordHint")} type="password" autoComplete="new-password" minLength={8} required />
      <button className="btn u" disabled={pending}>{t("resetBtn")}</button>
      <p className="hint u">{err}</p>
    </form>
  )
}
