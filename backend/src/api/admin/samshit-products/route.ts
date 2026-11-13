import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { catalog, catalogError } from "./shared"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ products: await catalog(req).list() })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const id = await catalog(req).saveDraft(req.body)
    res.status(201).json({ id })
  } catch (error) {
    if (!catalogError(error, res)) throw error
  }
}
