import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BOG_MOCK, notFound } from "../../../lib/bog-mock"

export const POST = async (_req: MedusaRequest, res: MedusaResponse) => {
  if (!BOG_MOCK) return notFound(res)
  res.json({ access_token: "mock-token", token_type: "Bearer", expires_in: 600 })
}
