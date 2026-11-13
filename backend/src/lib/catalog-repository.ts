import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow, createProductsWorkflow, updateInventoryLevelsWorkflow, updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { fromMedusaProduct, SIZES, validatePersistedVariants, type Currency, type Prices, type Size, type PersistedVariant } from "./catalog"
import { CatalogValidationError, type CatalogRecord, type CatalogReferences, type CatalogRepository, type CatalogSummary } from "./catalog-service"
import { checkCatalogImages } from "./catalog-images"
import { join } from "node:path"

type Container = MedusaRequest["scope"]
type InventoryVariant = { title: string; inventory_item_id: string | null }
type InventoryLevel = { inventory_item_id: string; location_id: string; stocked_quantity: number }

export function planInventoryLevels(
  variants: InventoryVariant[], levels: InventoryLevel[], stock: Record<Size, number>, locationId: string,
) {
  const create: InventoryLevel[] = []
  const update: InventoryLevel[] = []
  for (const variant of variants) {
    if (!SIZES.includes(variant.title as Size)) continue
    if (!variant.inventory_item_id) throw new Error(`Нет записи склада для размера ${variant.title}`)
    const level = levels.find((item) => item.inventory_item_id === variant.inventory_item_id && item.location_id === locationId)
    const desired = { inventory_item_id: variant.inventory_item_id, location_id: locationId, stocked_quantity: stock[variant.title as Size] }
    if (!level) create.push(desired)
    else if (level.stocked_quantity !== desired.stocked_quantity) update.push(desired)
  }
  return { create, update }
}

const PRODUCT_FIELDS = [
  "id", "handle", "title", "subtitle", "description", "status", "metadata", "thumbnail",
  "images.url", "categories.handle", "variants.id", "variants.title", "variants.sku",
  "sales_channels.id", "shipping_profile.id",
  "variants.manage_inventory", "variants.allow_backorder", "variants.prices.currency_code", "variants.prices.amount", "variants.inventory_items.inventory_item_id",
]

type ProductRow = {
  id: string; handle: string; title: string; subtitle?: string | null; description?: string | null
  status: string; metadata?: Record<string, unknown> | null; thumbnail?: string | null
  images?: { url: string }[]; categories?: { handle: string }[]
  sales_channels?: { id: string }[]; shipping_profile?: { id: string } | null
  variants?: { id: string; title: string; sku?: string | null; manage_inventory?: boolean; allow_backorder?: boolean; prices?: { currency_code: string; amount: number }[]; inventory_items?: { inventory_item_id: string }[] }[]
}

export class MedusaCatalogRepository implements CatalogRepository {
  private readonly query = this.container.resolve(ContainerRegistrationKeys.QUERY)
  private readonly products = this.container.resolve(Modules.PRODUCT)
  private readonly salesChannels = this.container.resolve(Modules.SALES_CHANNEL)
  private readonly fulfillment = this.container.resolve(Modules.FULFILLMENT)
  private readonly locations = this.container.resolve(Modules.STOCK_LOCATION)

  constructor(private readonly container: Container) {}

  private async product(id: string): Promise<ProductRow | null> {
    const { data } = await this.query.graph({ entity: "product", filters: { id }, fields: PRODUCT_FIELDS })
    return (data[0] as unknown as ProductRow) ?? null
  }

  async list(): Promise<CatalogSummary[]> {
    const summaries: CatalogSummary[] = []
    for (let skip = 0; ; skip += 100) {
      const batch = await this.products.listProducts({}, { skip, take: 100, order: { created_at: "DESC" } })
      for (const product of batch) {
        const metadata = product.metadata as Record<string, unknown> | null
        summaries.push({
          id: product.id, handle: product.handle ?? "", title: product.title,
          sku: typeof metadata?.sku_base === "string" ? metadata.sku_base : product.subtitle ?? "",
          status: product.status, thumbnail: product.thumbnail ?? null,
        })
      }
      if (batch.length < 100) break
    }
    return summaries
  }

  async get(id: string): Promise<CatalogRecord | null> {
    const product = await this.product(id)
    if (!product) return null
    const itemIds = (product.variants ?? []).flatMap((variant) => (variant.inventory_items ?? []).map((item) => item.inventory_item_id))
    const [location] = await this.locations.listStockLocations({ name: "Мастерская, Тбилиси" })
    const levels = itemIds.length && location ? (await this.query.graph({
      entity: "inventory_level", filters: { inventory_item_id: itemIds, location_id: location.id },
      fields: ["inventory_item_id", "location_id", "stocked_quantity"],
    })).data as unknown as InventoryLevel[] : []
    const variants = (product.variants ?? []).map((variant) => ({
      ...variant,
      inventory_quantity: levels.find((level) => variant.inventory_items?.some((item) => item.inventory_item_id === level.inventory_item_id))?.stocked_quantity ?? 0,
    }))
    const input = fromMedusaProduct({ ...product, variants })
    const persisted: PersistedVariant[] = variants.map((variant) => {
      const prices = { usd: 0, eur: 0, gel: 0 } as Prices
      for (const price of variant.prices ?? []) if (price.currency_code in prices) prices[price.currency_code as Currency] = price.amount
      const itemId = variant.inventory_items?.[0]?.inventory_item_id ?? null
      return {
        title: variant.title, sku: variant.sku ?? null,
        manage_inventory: variant.manage_inventory === true, allow_backorder: variant.allow_backorder === true,
        prices, inventory_item_id: itemId,
        has_stock_level: !!levels.find((level) => level.inventory_item_id === itemId),
      }
    })
    const [[channel], [profile]] = await Promise.all([
      this.salesChannels.listSalesChannels({ name: "Samshit web" }, { take: 1 }),
      this.fulfillment.listShippingProfiles({ type: "default" }, { take: 1 }),
    ])
    const variantErrors = validatePersistedVariants(input, persisted)
    if (!channel || !product.sales_channels?.some((item) => item.id === channel.id)) {
      variantErrors.push({ field: "sales_channels", message: "Нет канала продаж Samshit web" })
    }
    if (!profile || product.shipping_profile?.id !== profile.id) {
      variantErrors.push({ field: "shipping_profile", message: "Нет профиля доставки по умолчанию" })
    }
    return { id: product.id, status: product.status, input, variantTitles: variants.map((variant) => variant.title), variantErrors }
  }

  async findHandle(handle: string): Promise<string | null> {
    const [product] = await this.products.listProducts({ handle }, { take: 1 })
    return product?.id ?? null
  }

  async findSku(sku: string): Promise<string | null> {
    const [variant] = await this.products.listProductVariants({ sku }, { take: 1 })
    return variant?.product_id ?? null
  }

  async resolveReferences(category: string): Promise<CatalogReferences> {
    const [[cat], [channel], [profile], [location]] = await Promise.all([
      this.products.listProductCategories({ handle: category }, { take: 1 }),
      this.salesChannels.listSalesChannels({ name: "Samshit web" }, { take: 1 }),
      this.fulfillment.listShippingProfiles({ type: "default" }, { take: 1 }),
      this.locations.listStockLocations({ name: "Мастерская, Тбилиси" }, { take: 1 }),
    ])
    const missing = [!cat && "category", !channel && "sales channel", !profile && "shipping profile", !location && "stock location"].filter(Boolean)
    if (missing.length) throw new CatalogValidationError([{ field: "category", message: `Не настроены данные магазина: ${missing.join(", ")}` }])
    return { categoryId: cat.id, channelId: channel.id, profileId: profile.id, locationId: location.id }
  }

  async createDraft(input: Parameters<CatalogRepository["createDraft"]>[0]): Promise<string> {
    const { result } = await createProductsWorkflow(this.container).run({ input: { products: [input] } })
    return result[0].id
  }

  private async update(id: string, input: Parameters<CatalogRepository["updateDraft"]>[1], published: boolean): Promise<void> {
    const existing = await this.product(id)
    if (!existing) throw new Error("Товар не найден")
    const variantIds = new Map((existing.variants ?? []).map((variant) => [variant.title, variant.id]))
    await updateProductsWorkflow(this.container).run({
      input: {
        selector: { id },
        update: {
          title: input.title, handle: input.handle, subtitle: input.subtitle, description: input.description,
          status: published ? ProductStatus.PUBLISHED : ProductStatus.DRAFT, category_ids: input.category_ids,
          shipping_profile_id: input.shipping_profile_id, sales_channels: input.sales_channels,
          images: input.images, thumbnail: input.thumbnail,
          metadata: { ...(existing.metadata ?? {}), ...input.metadata, placeholder: false, catalog_ready: published },
          variants: input.variants.map((variant) => ({ ...variant, id: variantIds.get(variant.title)! })),
        },
      },
    })
  }

  async updateDraft(id: string, input: Parameters<CatalogRepository["updateDraft"]>[1]): Promise<void> {
    await this.update(id, input, false)
  }

  async updatePublished(id: string, input: Parameters<CatalogRepository["updatePublished"]>[1]): Promise<void> {
    await this.update(id, input, true)
  }

  async checkImages(urls: string[]) {
    return checkCatalogImages(urls, {
      staticDir: join(process.cwd(), "static"),
      apiUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
      s3Url: process.env.S3_FILE_URL,
    })
  }

  async setStock(id: string, stock: Record<Size, number>, locationId: string): Promise<void> {
    const product = await this.product(id)
    if (!product) throw new Error("Товар не найден")
    const variants = (product.variants ?? []).map((variant) => ({ title: variant.title, inventory_item_id: variant.inventory_items?.[0]?.inventory_item_id ?? null }))
    const itemIds = variants.map((variant) => variant.inventory_item_id).filter((item): item is string => !!item)
    const levels = itemIds.length ? (await this.query.graph({
      entity: "inventory_level", filters: { inventory_item_id: itemIds, location_id: locationId },
      fields: ["inventory_item_id", "location_id", "stocked_quantity"],
    })).data as unknown as InventoryLevel[] : []
    const plan = planInventoryLevels(variants, levels, stock, locationId)
    if (plan.create.length) await createInventoryLevelsWorkflow(this.container).run({ input: { inventory_levels: plan.create } })
    if (plan.update.length) await updateInventoryLevelsWorkflow(this.container).run({ input: { updates: plan.update } })
  }

  async markPublished(id: string): Promise<void> {
    const product = await this.product(id)
    if (!product) throw new Error("Товар не найден")
    await updateProductsWorkflow(this.container).run({
      input: { selector: { id }, update: { status: ProductStatus.PUBLISHED, metadata: { ...(product.metadata ?? {}), catalog_ready: true } } },
    })
  }
}
