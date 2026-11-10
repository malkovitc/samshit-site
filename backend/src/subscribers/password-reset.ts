import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { asLocale, resetEmail } from "../lib/emails"
import { sendEmail } from "../lib/mailer"

type ResetEvent = { entity_id: string; actor_type: string; token: string; metadata?: { locale?: string } }

/**
 * Ссылка для смены пароля (событие auth.password_reset). Покупателю — страница кабинета на витрине,
 * сотруднику — страница сброса в админке Medusa. Язык письма: из запроса, иначе из профиля покупателя.
 */
export default async function onPasswordReset({ event, container }: SubscriberArgs<ResetEvent>) {
  const log = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { entity_id: email, actor_type, token, metadata } = event.data
  const store = process.env.STORE_URL || "https://samshit.linza-ai.xyz"
  const api = process.env.MEDUSA_BACKEND_URL || ""
  const q = `token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
  let locale = asLocale(metadata?.locale)
  if (actor_type === "customer" && !metadata?.locale) {
    const [c] = await container.resolve(Modules.CUSTOMER).listCustomers({ email, has_account: true }, { take: 1 })
    locale = asLocale((c?.metadata as { locale?: string } | null)?.locale)
  }
  const url = actor_type === "user" ? `${api}/app/reset-password?${q}` : `${store}/${locale}/account/reset?${q}`
  // ключ по jti токена: повтор события не шлёт второе письмо, новый запрос — шлёт
  const jti = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString() || "{}").jti ?? token.slice(-24)
  await sendEmail({ to: email, ...resetEmail(locale, url), idempotencyKey: `samshit-reset-${jti}` }, log)
}

export const config: SubscriberConfig = { event: "auth.password_reset" }
