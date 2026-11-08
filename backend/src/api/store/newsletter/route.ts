import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { NEWSLETTER_MODULE } from "../../../modules/newsletter"
import type NewsletterModuleService from "../../../modules/newsletter/service"
import { subscribe, validEmail } from "../../../lib/newsletter"

// POST /store/newsletter { email, locale?, source? } — подписка из подвала, при регистрации и т. п.
export async function POST(req: MedusaRequest<{ email?: string; locale?: string; source?: string }>, res: MedusaResponse) {
  const { email, locale, source } = req.body ?? {}
  if (!validEmail(email)) return res.status(400).json({ message: "invalid_email" })
  const service = req.scope.resolve<NewsletterModuleService>(NEWSLETTER_MODULE)
  const log = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const result = await subscribe(service, log, { email, locale, source: typeof source === "string" ? source.slice(0, 32) : "footer" })
  res.json(result)
}
