import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { catalog, catalogError } from "../shared"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    res.json({ product: await catalog(req).get(req.params.id) })
  } catch (error) {
    if (!catalogError(error, res)) throw error
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const id = await catalog(req).saveDraft(req.body, req.params.id)
    res.json({ id })
  } catch (error) {
    if (!catalogError(error, res)) throw error
  }
}
