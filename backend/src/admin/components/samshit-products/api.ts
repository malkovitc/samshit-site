import type { CatalogInput, CatalogError } from "../../../lib/catalog"

export type CatalogSummary = { id: string; handle: string; title: string; sku: string; status: string; thumbnail: string | null }
export type CatalogRecord = { id: string; status: string; input: CatalogInput }

export class CatalogApiError extends Error {
  constructor(message: string, public readonly errors: CatalogError[] = [], public readonly id?: string) { super(message) }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "include" })
  const body = await response.json().catch(() => ({})) as { message?: string; errors?: CatalogError[]; id?: string }
  if (!response.ok) throw new CatalogApiError(body.message || `Ошибка ${response.status}`, body.errors ?? [], body.id)
  return body as T
}

export async function listCatalog(): Promise<CatalogSummary[]> {
  return (await api<{ products: CatalogSummary[] }>("/admin/samshit-products")).products
}

export async function getCatalog(id: string): Promise<CatalogRecord> {
  return (await api<{ product: CatalogRecord }>(`/admin/samshit-products/${id}`)).product
}

export async function saveCatalog(input: CatalogInput, id?: string): Promise<string> {
  const result = await api<{ id: string }>(id ? `/admin/samshit-products/${id}` : "/admin/samshit-products", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  })
  return result.id
}

export async function publishCatalog(id: string, input?: CatalogInput): Promise<void> {
  await api(`/admin/samshit-products/${id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input ?? {}) })
}

export async function uploadCatalogImages(files: FileList): Promise<string[]> {
  const form = new FormData()
  Array.from(files).forEach((file) => form.append("files", file))
  return (await api<{ files: { url: string }[] }>("/admin/uploads", { method: "POST", body: form })).files.map((file) => file.url)
}
