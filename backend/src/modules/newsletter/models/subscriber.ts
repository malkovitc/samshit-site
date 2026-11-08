import { model } from "@medusajs/framework/utils"

// Подписчик рассылки. token — для ссылки отписки в каждом письме.
const Subscriber = model.define("newsletter_subscriber", {
  id: model.id({ prefix: "nsub" }).primaryKey(),
  email: model.text().unique(),
  locale: model.text().default("en"),
  status: model.enum(["subscribed", "unsubscribed"]).default("subscribed"),
  token: model.text().unique(),
  source: model.text().default("footer"),
})

export default Subscriber
