import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { catalog, catalogError } from "../../shared"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const input = req.body && Object.keys(req.body as object).length ? req.body : undefined
    await catalog(req).publish(req.params.id, input)
    res.json({ id: req.params.id, status: "published" })
  } catch (error) {
    if (!catalogError(error, res)) throw error
  }
}
