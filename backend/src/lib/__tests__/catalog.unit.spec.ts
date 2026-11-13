import { buildProductInput, fromMedusaProduct, validateCatalog, validateDraft, validatePersistedVariants, type CatalogInput } from "../catalog"

const valid = (): CatalogInput => ({
  handle: "shield-indigo",
  sku: "SAM-JK02-DNM",
  category: "jackets",
  images: ["/static/p06.jpg", "https://cdn.example.com/p03.jpg"],
  i18n: {
    ru: { title: "Куртка Щит", construction: "Крой", material: "Хлопок" },
    en: { title: "Shield jacket", construction: "Cut", material: "Cotton" },
    ka: { title: "ქურთუკი ფარი", construction: "ჭრა", material: "ბამბა" },
  },
  prices: { usd: 420, eur: 386, gel: 1135 },
  mtm_prices: { usd: 460, eur: 423, gel: 1240 },
  stock: { S: 0, M: 1, L: 0, XL: 1 },
  lead_days: 14,
  edition: { current: 7, total: 12 },
  preorder_from: null,
})

describe("Samshit catalog contract", () => {
  test("accepts a complete product", () => {
    expect(validateCatalog(valid())).toEqual([])
  })

  test("reports every missing translation, photo, and regional price", () => {
    const product = valid()
    product.i18n.en.material = ""
    product.i18n.ka.title = ""
    product.images = []
    product.prices.eur = 0
    expect(validateCatalog(product).map((e) => e.field)).toEqual(expect.arrayContaining([
      "i18n.en.material", "i18n.ka.title", "images", "prices.eur",
    ]))
  })

  test("rejects invalid stock, edition, and made-to-measure prices", () => {
    const product = valid()
    product.stock.S = -1
    product.stock.M = 1.5
    product.edition = { current: 13, total: 12 }
    product.mtm_prices!.gel = 100
    expect(validateCatalog(product).map((e) => e.field)).toEqual(expect.arrayContaining([
      "stock.S", "stock.M", "edition.current", "mtm_prices.gel",
    ]))
  })

  test("rejects malformed quantities and dates before saving a draft", () => {
    const product = valid()
    product.stock.S = -2
    product.prices.usd = -1
    product.edition = { current: 4, total: 3 }
    product.preorder_from = "2026-02-31"
    expect(validateDraft(product).map((e) => e.field)).toEqual(expect.arrayContaining([
      "stock.S", "prices.usd", "edition.current", "preorder_from",
    ]))
  })

  test("builds the existing Medusa product shape as a draft", () => {
    const product = buildProductInput(valid(), { categoryId: "cat_1", channelId: "sc_1", profileId: "sp_1" })
    expect(product.status).toBe("draft")
    expect(product.category_ids).toEqual(["cat_1"])
    expect(product.sales_channels).toEqual([{ id: "sc_1" }])
    expect(product.metadata.i18n.en.title).toBe("Shield jacket")
    expect(product.variants).toHaveLength(5)
    expect(product.variants[0]).toMatchObject({ sku: "SAM-JK02-DNM-S", manage_inventory: true, allow_backorder: true })
    expect(product.variants[4]).toMatchObject({ sku: "SAM-JK02-DNM-MTM", manage_inventory: false })
  })

  test("loads seeded metadata into the owner form", () => {
    const input = fromMedusaProduct({
      handle: "shield-indigo", title: "Куртка Щит", subtitle: "SAM-JK02-DNM",
      images: [{ url: "/static/p06.jpg" }],
      categories: [{ handle: "jackets" }],
      metadata: { sku_base: "SAM-JK02-DNM", lead_days: 14, edition_current: 7, edition_total: 12, preorder_from: null, i18n: valid().i18n },
      variants: [
        { title: "S", sku: "SAM-JK02-DNM-S", inventory_quantity: 0, prices: [{ currency_code: "usd", amount: 420 }, { currency_code: "eur", amount: 386 }, { currency_code: "gel", amount: 1135 }] },
        { title: "MTM", sku: "SAM-JK02-DNM-MTM", prices: [{ currency_code: "usd", amount: 460 }, { currency_code: "eur", amount: 423 }, { currency_code: "gel", amount: 1240 }] },
      ],
    })
    expect(input.images).toEqual(["/static/p06.jpg"])
    expect(input.prices).toEqual({ usd: 420, eur: 386, gel: 1135 })
    expect(input.mtm_prices).toEqual({ usd: 460, eur: 423, gel: 1240 })
    expect(input.stock.S).toBe(0)
    expect(input.edition).toEqual({ current: 7, total: 12 })
  })

  test("catches a broken price or inventory setting on a persisted size", () => {
    const input = valid()
    const variants = ["S", "M", "L", "XL"].map((title) => ({
      title, sku: `${input.sku}-${title}`, manage_inventory: true, allow_backorder: true,
      prices: { ...input.prices }, inventory_item_id: `item_${title}`, has_stock_level: true,
    }))
    variants[2].prices.eur = 0
    variants[2].allow_backorder = false
    variants[2].has_stock_level = false
    const errors = validatePersistedVariants({ ...input, mtm_prices: null }, variants)
    expect(errors.map((error) => error.field)).toEqual(expect.arrayContaining([
      "variants.L.prices.eur", "variants.L.allow_backorder", "variants.L.stock",
    ]))
  })
})
