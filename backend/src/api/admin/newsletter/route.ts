import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { NEWSLETTER_MODULE } from "../../../modules/newsletter"
import type NewsletterModuleService from "../../../modules/newsletter/service"

// GET /admin/newsletter — подписчики и счётчики по языкам
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<NewsletterModuleService>(NEWSLETTER_MODULE)
  const subscribers = await service.listSubscribers({}, { order: { created_at: "DESC" }, take: 1000 })
  const active = subscribers.filter((s) => s.status === "subscribed")
  const byLocale = active.reduce<Record<string, number>>((m, s) => ({ ...m, [s.locale]: (m[s.locale] ?? 0) + 1 }), {})
  res.json({
    counts: { subscribed: active.length, unsubscribed: subscribers.length - active.length, by_locale: byLocale },
    subscribers: subscribers.map((s) => ({ email: s.email, locale: s.locale, status: s.status, source: s.source, created_at: s.created_at })),
  })
}
