import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { asLocale, welcomeEmail } from "../lib/emails"
import { sendEmail } from "../lib/mailer"
import { subscribe } from "../lib/newsletter"
import { NEWSLETTER_MODULE } from "../modules/newsletter"
import type NewsletterModuleService from "../modules/newsletter/service"

// Письмо после регистрации; если покупатель отметил «новости» — подписываем без второго письма.
export default async function onCustomerCreated({ event, container }: SubscriberArgs<{ id: string }>) {
  const log = container.resolve(ContainerRegistrationKeys.LOGGER)
  const customer = await container.resolve(Modules.CUSTOMER).retrieveCustomer(event.data.id)
  if (!customer.has_account) return // гостевые покупатели из оформления заказа — без письма
  const meta = (customer.metadata ?? {}) as { locale?: string; newsletter?: boolean }
  const locale = asLocale(meta.locale)
  const mail = welcomeEmail(locale, customer.first_name)
  await sendEmail({ to: customer.email, ...mail, idempotencyKey: `samshit-welcome-${customer.id}` }, log)
  if (meta.newsletter) {
    await subscribe(container.resolve<NewsletterModuleService>(NEWSLETTER_MODULE), log, { email: customer.email, locale, source: "signup", notify: false })
  }
}

export const config: SubscriberConfig = { event: "customer.created" }
