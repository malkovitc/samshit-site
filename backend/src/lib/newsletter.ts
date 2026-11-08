import { randomBytes } from "node:crypto"
import type NewsletterModuleService from "../modules/newsletter/service"
import { asLocale, subscribedEmail, type Locale } from "./emails"
import { sendEmail } from "./mailer"

const STORE = () => process.env.STORE_URL || "https://samshit.linza-ai.xyz"
export const unsubscribeUrl = (locale: Locale, token: string) => `${STORE()}/${locale}/unsubscribe?token=${token}`
export const validEmail = (e: unknown): e is string => typeof e === "string" && e.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)

type Log = { info: (m: string) => void; warn: (m: string) => void }

/**
 * Подписать адрес. Новый или вернувшийся подписчик получает письмо «вы подписаны» с ссылкой отписки;
 * повторная подписка уже подписанного ничего не шлёт.
 */
export async function subscribe(service: NewsletterModuleService, log: Log, input: { email: string; locale?: string; source?: string; notify?: boolean }) {
  const email = input.email.trim().toLowerCase()
  const locale = asLocale(input.locale)
  const [existing] = await service.listSubscribers({ email })
  let sub = existing
  let changed = false
  if (!existing) {
    sub = await service.createSubscribers({ email, locale, source: input.source ?? "footer", token: randomBytes(18).toString("base64url") })
    changed = true
  } else if (existing.status !== "subscribed") {
    sub = await service.updateSubscribers({ id: existing.id, status: "subscribed", locale })
    changed = true
  }
  if (changed && input.notify !== false) {
    const mail = subscribedEmail(locale, unsubscribeUrl(locale, sub.token))
    await sendEmail({ to: email, ...mail, idempotencyKey: `samshit-subscribed-${sub.id}-${Math.floor(Date.now() / 3_600_000)}` }, log)
  }
  return { status: changed ? "subscribed" : "already" }
}
