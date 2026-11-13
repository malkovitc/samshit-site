import { CatalogPartialSaveError, CatalogService, CatalogValidationError, type CatalogRepository } from "../catalog-service"
import type { CatalogInput } from "../catalog"

const complete = (): CatalogInput => ({
  handle: "new-jacket", sku: "SAM-JK99-BLK", category: "jackets",
  images: ["/static/new.jpg"],
  i18n: {
    ru: { title: "Новая куртка", construction: "Крой", material: "Хлопок" },
    en: { title: "New jacket", construction: "Cut", material: "Cotton" },
    ka: { title: "ახალი ქურთუკი", construction: "ჭრა", material: "ბამბა" },
  },
  prices: { usd: 100, eur: 90, gel: 270 }, mtm_prices: null,
  stock: { S: 0, M: 1, L: 0, XL: 0 }, lead_days: 14,
  edition: null, preorder_from: null,
})

function fakeRepository(): jest.Mocked<CatalogRepository> {
  return {
    list: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue(null),
    findHandle: jest.fn().mockResolvedValue(null),
    findSku: jest.fn().mockResolvedValue(null),
    resolveReferences: jest.fn().mockResolvedValue({ categoryId: "cat_1", channelId: "sc_1", profileId: "sp_1", locationId: "loc_1" }),
    createDraft: jest.fn().mockResolvedValue("prod_1"),
    updateDraft: jest.fn().mockResolvedValue(undefined),
    updatePublished: jest.fn().mockResolvedValue(undefined),
    setStock: jest.fn().mockResolvedValue(undefined),
    markPublished: jest.fn().mockResolvedValue(undefined),
    checkImages: jest.fn().mockResolvedValue([]),
  }
}

describe("owner catalog application", () => {
  test("creates a draft with stock and keeps publication separate", async () => {
    const repo = fakeRepository()
    const service = new CatalogService(repo)
    const id = await service.saveDraft(complete())
    expect(id).toBe("prod_1")
    expect(repo.createDraft).toHaveBeenCalledWith(expect.objectContaining({ status: "draft" }), expect.anything())
    expect(repo.setStock).toHaveBeenCalledWith("prod_1", complete().stock, "loc_1")
    expect(repo.markPublished).not.toHaveBeenCalled()
  })

  test("rejects a duplicate handle before creating", async () => {
    const repo = fakeRepository()
    repo.findHandle.mockResolvedValue("prod_existing")
    await expect(new CatalogService(repo).saveDraft(complete())).rejects.toMatchObject({
      errors: [{ field: "handle" }],
    })
    expect(repo.createDraft).not.toHaveBeenCalled()
  })

  test("allows incomplete details in a draft, but blocks publication", async () => {
    const repo = fakeRepository()
    const input = complete()
    input.images = []
    input.prices.eur = 0
    await new CatalogService(repo).saveDraft(input)
    repo.get.mockResolvedValue({ id: "prod_1", status: "draft", input, variantTitles: ["S", "M", "L", "XL"] })
    await expect(new CatalogService(repo).publish("prod_1")).rejects.toBeInstanceOf(CatalogValidationError)
    expect(repo.markPublished).not.toHaveBeenCalled()
  })

  test("publishes only a persisted complete product with all four sizes", async () => {
    const repo = fakeRepository()
    repo.get.mockResolvedValue({ id: "prod_1", status: "draft", input: complete(), variantTitles: ["S", "M", "L", "XL"] })
    await new CatalogService(repo).publish("prod_1")
    expect(repo.markPublished).toHaveBeenCalledWith("prod_1")
  })

  test("blocks publication when a size variant was removed in Medusa", async () => {
    const repo = fakeRepository()
    repo.get.mockResolvedValue({ id: "prod_1", status: "draft", input: complete(), variantTitles: ["S", "M", "XL"] })
    await expect(new CatalogService(repo).publish("prod_1")).rejects.toMatchObject({
      errors: [{ field: "variants.L" }],
    })
  })

  test("updates an existing product as a draft", async () => {
    const repo = fakeRepository()
    repo.get.mockResolvedValue({ id: "prod_1", status: "published", input: complete(), variantTitles: ["S", "M", "L", "XL"] })
    const id = await new CatalogService(repo).saveDraft(complete(), "prod_1")
    expect(id).toBe("prod_1")
    expect(repo.updateDraft).toHaveBeenCalledWith("prod_1", expect.objectContaining({ status: "draft" }), expect.anything())
    expect(repo.markPublished).not.toHaveBeenCalled()
  })

  test("returns the draft ID when stock saving fails after product creation", async () => {
    const repo = fakeRepository()
    repo.setStock.mockRejectedValue(new Error("stock unavailable"))
    await expect(new CatalogService(repo).saveDraft(complete())).rejects.toMatchObject({
      id: "prod_1",
    })
    await expect(new CatalogService(repo).saveDraft(complete())).rejects.toBeInstanceOf(CatalogPartialSaveError)
  })

  test("invalid published edit leaves the live product untouched", async () => {
    const repo = fakeRepository()
    repo.get.mockResolvedValue({ id: "prod_1", status: "published", input: complete(), variantTitles: ["S", "M", "L", "XL"] })
    const changed = complete()
    changed.prices.eur = 0
    await expect(new CatalogService(repo).publish("prod_1", changed)).rejects.toBeInstanceOf(CatalogValidationError)
    expect(repo.setStock).not.toHaveBeenCalled()
    expect(repo.updatePublished).not.toHaveBeenCalled()
    expect(repo.updateDraft).not.toHaveBeenCalled()
  })

  test("stock failure during a published edit does not unpublish it", async () => {
    const repo = fakeRepository()
    repo.get.mockResolvedValue({ id: "prod_1", status: "published", input: complete(), variantTitles: ["S", "M", "L", "XL"] })
    repo.setStock.mockRejectedValueOnce(new Error("stock unavailable")).mockResolvedValueOnce(undefined)
    await expect(new CatalogService(repo).publish("prod_1", complete())).rejects.toThrow("stock unavailable")
    expect(repo.setStock).toHaveBeenNthCalledWith(2, "prod_1", complete().stock, "loc_1")
    expect(repo.updatePublished).not.toHaveBeenCalled()
    expect(repo.updateDraft).not.toHaveBeenCalled()
  })

  test("failed published product update restores its old stock", async () => {
    const repo = fakeRepository()
    const previous = complete()
    previous.stock.M = 3
    const changed = complete()
    changed.stock.M = 1
    repo.get.mockResolvedValue({ id: "prod_1", status: "published", input: previous, variantTitles: ["S", "M", "L", "XL"] })
    repo.updatePublished.mockRejectedValue(new Error("product update failed"))
    await expect(new CatalogService(repo).publish("prod_1", changed)).rejects.toThrow("product update failed")
    expect(repo.setStock).toHaveBeenNthCalledWith(1, "prod_1", changed.stock, "loc_1")
    expect(repo.setStock).toHaveBeenNthCalledWith(2, "prod_1", previous.stock, "loc_1")
  })

  test("published edit can repair stale price or sales channel errors", async () => {
    const repo = fakeRepository()
    repo.get.mockResolvedValue({
      id: "prod_1", status: "published", input: complete(), variantTitles: ["S", "M", "L", "XL"],
      variantErrors: [{ field: "sales_channels", message: "Нет канала продаж Samshit web" }],
    })
    await new CatalogService(repo).publish("prod_1", complete())
    expect(repo.updatePublished).toHaveBeenCalled()
  })

  test("failed conversion of a published product to draft restores stock", async () => {
    const repo = fakeRepository()
    const previous = complete()
    previous.stock.M = 3
    const changed = complete()
    changed.stock.M = 1
    repo.get.mockResolvedValue({ id: "prod_1", status: "published", input: previous, variantTitles: ["S", "M", "L", "XL"] })
    repo.updateDraft.mockRejectedValue(new Error("draft update failed"))
    await expect(new CatalogService(repo).saveDraft(changed, "prod_1")).rejects.toThrow("draft update failed")
    expect(repo.setStock).toHaveBeenNthCalledWith(2, "prod_1", previous.stock, "loc_1")
  })

  test("published edit keeps publication and updates product after stock", async () => {
    const repo = fakeRepository()
    repo.get.mockResolvedValue({ id: "prod_1", status: "published", input: complete(), variantTitles: ["S", "M", "L", "XL"] })
    await new CatalogService(repo).publish("prod_1", complete())
    expect(repo.updatePublished).toHaveBeenCalledWith("prod_1", expect.anything(), expect.anything())
    expect(repo.setStock.mock.invocationCallOrder[0]).toBeLessThan(repo.updatePublished.mock.invocationCallOrder[0])
    expect(repo.updateDraft).not.toHaveBeenCalled()
  })

  test("missing sales channel or shipping profile blocks publication", async () => {
    const repo = fakeRepository()
    repo.get.mockResolvedValue({
      id: "prod_1", status: "draft", input: complete(), variantTitles: ["S", "M", "L", "XL"],
      variantErrors: [{ field: "sales_channels", message: "Нет канала продаж Samshit web" }],
    })
    await expect(new CatalogService(repo).publish("prod_1")).rejects.toMatchObject({ errors: [{ field: "sales_channels" }] })
    expect(repo.markPublished).not.toHaveBeenCalled()
  })
})
