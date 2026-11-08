import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { asLocale, orderEmail } from "../lib/emails"
import { sendEmail } from "../lib/mailer"

// Подтверждение заказа на языке, на котором покупатель оформлял (metadata.locale из корзины).
export default async function onOrderPlaced({ event, container }: SubscriberArgs<{ id: string }>) {
  const log = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: [order] } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "currency_code", "total", "metadata", "items.*", "items.product.metadata"],
    filters: { id: event.data.id },
  })
  if (!order?.email) return
  const locale = asLocale((order.metadata as { locale?: string } | null)?.locale)
  const mail = orderEmail(locale, order as never)
  await sendEmail({ to: order.email, ...mail, idempotencyKey: `samshit-order-${order.id}` }, log)
}

export const config: SubscriberConfig = { event: "order.placed" }
