import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaCatalogRepository } from "../../../lib/catalog-repository"
import { CatalogNotFoundError, CatalogPartialSaveError, CatalogService, CatalogStockRollbackError, CatalogValidationError } from "../../../lib/catalog-service"

export const catalog = (req: MedusaRequest) => new CatalogService(new MedusaCatalogRepository(req.scope))

export function catalogError(error: unknown, res: MedusaResponse): boolean {
  if (error instanceof CatalogPartialSaveError) {
    res.status(409).json({ message: error.message, id: error.id })
    return true
  }
  if (error instanceof CatalogStockRollbackError) {
    res.status(409).json({ message: error.message })
    return true
  }
  if (error instanceof CatalogValidationError) {
    res.status(422).json({ message: error.message, errors: error.errors })
    return true
  }
  if (error instanceof CatalogNotFoundError) {
    res.status(404).json({ message: error.message })
    return true
  }
  return false
}
