import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BOG_MOCK, createMockOrder, notFound } from "../../../../lib/bog-mock"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!BOG_MOCK) return notFound(res)
  const id = createMockOrder((req.body ?? {}) as Record<string, any>)
  const base = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
  res.json({ id, _links: { details: { href: `${base}/mock-bog/receipt/${id}` }, redirect: { href: `${base}/mock-bog/pay/${id}` } } })
}
