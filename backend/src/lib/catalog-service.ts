import {
  buildProductInput, CATEGORY_HANDLES, parseCatalog, SIZES, validateCatalog, validateDraft,
  type CatalogError, type CatalogInput, type CategoryHandle, type Size,
} from "./catalog"

export type CatalogRecord = {
  id: string
  status: string
  input: CatalogInput
  variantTitles: string[]
  variantErrors?: CatalogError[]
}
export type CatalogReferences = { categoryId: string; channelId: string; profileId: string; locationId: string }
export type CatalogSummary = { id: string; handle: string; title: string; sku: string; status: string; thumbnail: string | null }

export interface CatalogRepository {
  list(): Promise<CatalogSummary[]>
  get(id: string): Promise<CatalogRecord | null>
  findHandle(handle: string): Promise<string | null>
  findSku(sku: string): Promise<string | null>
  resolveReferences(category: string): Promise<CatalogReferences>
  createDraft(input: ReturnType<typeof buildProductInput>, refs: CatalogReferences): Promise<string>
  updateDraft(id: string, input: ReturnType<typeof buildProductInput>, refs: CatalogReferences): Promise<void>
  updatePublished(id: string, input: ReturnType<typeof buildProductInput>, refs: CatalogReferences): Promise<void>
  setStock(id: string, stock: Record<Size, number>, locationId: string): Promise<void>
  markPublished(id: string): Promise<void>
  checkImages(urls: string[]): Promise<CatalogError[]>
}

export class CatalogValidationError extends Error {
  constructor(public readonly errors: CatalogError[]) {
    super("Некорректные данные товара")
  }
}

export class CatalogNotFoundError extends Error {
  constructor() { super("Товар не найден") }
}

export class CatalogPartialSaveError extends Error {
  constructor(public readonly id: string) {
    super("Черновик создан, но остатки не сохранены. Повторите сохранение товара.")
  }
}

export class CatalogStockRollbackError extends Error {
  constructor(public readonly id: string) {
    super("Изменение не завершено. Проверьте остатки товара и повторите сохранение.")
  }
}

export class CatalogService {
  constructor(private readonly repo: CatalogRepository) {}

  list() { return this.repo.list() }

  private async updateWithStock(
    id: string, next: Record<Size, number>, previous: Record<Size, number>, locationId: string,
    update: () => Promise<void>,
  ) {
    try {
      await this.repo.setStock(id, next, locationId)
      await update()
    } catch (error) {
      try { await this.repo.setStock(id, previous, locationId) }
      catch { throw new CatalogStockRollbackError(id) }
      throw error
    }
  }

  async get(id: string) {
    const record = await this.repo.get(id)
    if (!record) throw new CatalogNotFoundError()
    return record
  }

  async saveDraft(value: unknown, id?: string): Promise<string> {
    const input = parseCatalog(value)
    const errors = validateDraft(input)
    if (!CATEGORY_HANDLES.includes(input.category as CategoryHandle)) errors.push({ field: "category", message: "Выберите категорию" })
    if (errors.length) throw new CatalogValidationError(errors)

    const existing = id ? await this.get(id) : null
    const [sameHandle, sameSku] = await Promise.all([this.repo.findHandle(input.handle), this.repo.findSku(`${input.sku}-S`)])
    if (sameHandle && sameHandle !== id) errors.push({ field: "handle", message: "Такой адрес уже занят" })
    if (sameSku && sameSku !== id) errors.push({ field: "sku", message: "Такой артикул уже занят" })
    if (existing && !!existing.input.mtm_prices !== !!input.mtm_prices) {
      errors.push({ field: "mtm_prices", message: "Наличие варианта MTM нельзя менять после создания товара" })
    }
    if (errors.length) throw new CatalogValidationError(errors)

    const refs = await this.repo.resolveReferences(input.category)
    const product = buildProductInput(input, refs)
    const productId = id ?? await this.repo.createDraft(product, refs)
    if (id && existing?.status === "published") {
      await this.updateWithStock(id, input.stock, existing.input.stock, refs.locationId, () => this.repo.updateDraft(id, product, refs))
      return id
    }
    if (id) await this.repo.updateDraft(id, product, refs)
    try {
      if (existing?.status !== "published") await this.repo.setStock(productId, input.stock, refs.locationId)
    } catch {
      throw new CatalogPartialSaveError(productId)
    }
    return productId
  }

  async publish(id: string, value?: unknown): Promise<void> {
    const record = await this.get(id)
    const input = value === undefined ? record.input : parseCatalog(value)
    const errors = [...validateCatalog(input), ...(value === undefined ? record.variantErrors ?? [] : [])]
    if (value !== undefined && !!record.input.mtm_prices !== !!input.mtm_prices) {
      errors.push({ field: "mtm_prices", message: "Наличие варианта MTM нельзя менять после создания товара" })
    }
    for (const size of SIZES) if (!record.variantTitles.includes(size)) {
      errors.push({ field: `variants.${size}`, message: `Отсутствует вариант размера ${size}` })
    }
    if (!!input.mtm_prices !== record.variantTitles.includes("MTM")) {
      errors.push({ field: "mtm_prices", message: "Вариант MTM не соответствует ценам" })
    }
    if (value !== undefined) {
      const [sameHandle, sameSku] = await Promise.all([this.repo.findHandle(input.handle), this.repo.findSku(`${input.sku}-S`)])
      if (sameHandle && sameHandle !== id) errors.push({ field: "handle", message: "Такой адрес уже занят" })
      if (sameSku && sameSku !== id) errors.push({ field: "sku", message: "Такой артикул уже занят" })
    }
    if (!errors.length) errors.push(...await this.repo.checkImages(input.images))
    if (errors.length) throw new CatalogValidationError(errors)
    if (value !== undefined) {
      const refs = await this.repo.resolveReferences(input.category)
      await this.updateWithStock(id, input.stock, record.input.stock, refs.locationId, () =>
        this.repo.updatePublished(id, buildProductInput(input, refs), refs))
      return
    }
    await this.repo.markPublished(id)
  }
}
