import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BOG_MOCK, getMockOrder, notFound, refundMock } from "../../../../../lib/bog-mock"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const o = BOG_MOCK ? getMockOrder(req.params.id) : undefined
  if (!o) return notFound(res)
  const amount = (req.body as { amount?: number } | undefined)?.amount
  refundMock(o, amount === undefined ? undefined : Number(amount))
  res.json({ key: "request_received", message: "Refund request received" })
}
