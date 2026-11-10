import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BOG_MOCK, getMockOrder, notFound, payPage } from "../../../../lib/bog-mock"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const o = BOG_MOCK ? getMockOrder(req.params.id) : undefined
  if (!o) return notFound(res)
  res.setHeader("Cache-Control", "no-store")
  res.type("html").send(payPage(o, process.env.MEDUSA_BACKEND_URL || ""))
}
