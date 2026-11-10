import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BOG_MOCK, getMockOrder, notFound, settle } from "../../../../../lib/bog-mock"

const RESULTS = ["card", "apple_pay", "google_pay", "decline"] as const

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const o = BOG_MOCK ? getMockOrder(req.params.id) : undefined
  const result = RESULTS.find((r) => r === req.params.result)
  if (!o || !result) return notFound(res)
  if (o.status !== "created") return res.redirect(303, o.status === "completed" ? o.redirect_urls.success : o.redirect_urls.fail)
  res.redirect(303, await settle(o, result))
}
