import { createHash } from "node:crypto"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { NEWSLETTER_MODULE } from "../../../../modules/newsletter"
import type NewsletterModuleService from "../../../../modules/newsletter/service"
import { asLocale, newsletterEmail, type Locale } from "../../../../lib/emails"
import { sendEmail } from "../../../../lib/mailer"
import { unsubscribeUrl, validEmail } from "../../../../lib/newsletter"

type Body = { content?: Partial<Record<Locale, { subject?: string; body?: string }>>; test_email?: string }

/**
 * POST /admin/newsletter/send — рассылка подписчикам на их языке (если текста на языке нет — английский).
 * test_email: отправить только себе, всеми заполненными языками. Повтор той же рассылки
 * не дублирует письма: ключ идемпотентности = хеш текста + адрес.
 */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const content = req.body?.content ?? {}
  const filled = (Object.keys(content) as Locale[]).filter((l) => content[l]?.subject?.trim() && content[l]?.body?.trim())
  if (!filled.length) return res.status(400).json({ message: "empty_content" })
  const pick = (l: Locale) => (filled.includes(l) ? l : filled.includes("en") ? "en" : filled[0])
  const campaign = createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 16)
  const log = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const test = req.body?.test_email
  if (test !== undefined) {
    if (!validEmail(test)) return res.status(400).json({ message: "invalid_email" })
    const results: string[] = []
    for (const l of filled) {
      const mail = newsletterEmail(l, content[l]!.subject!, content[l]!.body!, unsubscribeUrl(l, "test"))
      results.push((await sendEmail({ to: test, ...mail, idempotencyKey: `samshit-nl-test-${campaign}-${l}-${Date.now()}` }, log)).status)
    }
    return res.json({ test: true, sent: results.filter((s) => s === "sent").length, results })
  }

  const service = req.scope.resolve<NewsletterModuleService>(NEWSLETTER_MODULE)
  const subs = await service.listSubscribers({ status: "subscribed" }, { take: 5000 })
  const tally = { sent: 0, skipped: 0, failed: 0, disabled: 0 }
  for (const s of subs) {
    const l = pick(asLocale(s.locale))
    const mail = newsletterEmail(asLocale(s.locale), content[l]!.subject!, content[l]!.body!, unsubscribeUrl(asLocale(s.locale), s.token))
    const r = await sendEmail({ to: s.email, ...mail, idempotencyKey: `samshit-nl-${campaign}-${s.id}` }, log)
    tally[r.status]++
  }
  log.info(`[newsletter] campaign ${campaign}: ${JSON.stringify(tally)}`)
  res.json({ campaign, total: subs.length, ...tally })
}
