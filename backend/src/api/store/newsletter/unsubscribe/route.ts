import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { NEWSLETTER_MODULE } from "../../../../modules/newsletter"
import type NewsletterModuleService from "../../../../modules/newsletter/service"

// POST /store/newsletter/unsubscribe { token } — ссылка из письма. Неизвестный токен не раскрывает, есть ли адрес.
export async function POST(req: MedusaRequest<{ token?: string }>, res: MedusaResponse) {
  const token = req.body?.token
  if (typeof token !== "string" || token.length < 10 || token.length > 64) return res.status(400).json({ message: "invalid_token" })
  const service = req.scope.resolve<NewsletterModuleService>(NEWSLETTER_MODULE)
  const [sub] = await service.listSubscribers({ token })
  if (sub && sub.status !== "unsubscribed") await service.updateSubscribers({ id: sub.id, status: "unsubscribed" })
  res.json({ status: "unsubscribed" })
}
