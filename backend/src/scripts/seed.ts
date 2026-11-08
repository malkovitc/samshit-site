/**
 * Начальное наполнение магазина Самшит.
 *
 * Регионы: у региона Medusa одна валюта, поэтому переключатель валюты на витрине = выбор региона.
 *   Грузия (GEL) — самовывоз, курьер по Тбилиси, DHL;
 *   Европа (EUR) и Мир (USD) — DHL Express.
 * Товары: варианты S–XL с остатками (allow_backorder: нет на складе → шьётся под заказ)
 *   и вариант MTM «по меркам» без учёта остатков с доплатой.
 * Цены, остатки, сроки и тиражи — заглушки (решение владельца 08.11.2026).
 *
 * Скрипт идемпотентен только на пустой базе: повторный запуск на заполненной базе пропускается.
 */
import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import catalog from "./data/catalog.json"

type Item = (typeof catalog)[number]

const SIZES = ["S", "M", "L", "XL"] as const
const MTM_SURCHARGE_USD = 40 // заглушка
const RATE = { usd: 1, eur: 0.92, gel: 2.7 } // примерные курсы для заглушек цен
const roundTo = (v: number, step: number) => Math.round(v / step) * step
const priceSet = (usd: number) => [
  { currency_code: "usd", amount: usd },
  { currency_code: "eur", amount: roundTo(usd * RATE.eur, 1) },
  { currency_code: "gel", amount: roundTo(usd * RATE.gel, 5) },
]

const GEORGIA = ["ge"]
const EUROPE = ["de", "fr", "it", "es", "nl", "be", "at", "pt", "ie", "fi", "se", "dk", "pl", "cz", "lt", "lv", "ee", "gr", "cy"]
// Россия и Беларусь не включены: DHL Express туда не возит. Вопрос владельцу.
const WORLD = ["us", "ca", "gb", "ch", "no", "il", "ae", "tr", "am", "az", "kz", "uz", "kg", "ua", "md", "rs", "me", "jp", "kr", "sg", "au", "nz"]

const CATEGORIES: Record<string, { name: string; handle: string }> = {
  jk: { name: "Куртки", handle: "jackets" },
  pt: { name: "Брюки", handle: "trousers" },
  sw: { name: "Свитшоты и худи", handle: "sweatshirts" },
  ls: { name: "Лонгсливы", handle: "long-sleeves" },
}

export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const salesChannels = container.resolve(Modules.SALES_CHANNEL)
  const stores = container.resolve(Modules.STORE)
  const products = container.resolve(Modules.PRODUCT)

  if ((await products.listProducts({}, { take: 1 })).length) {
    logger.info("Seed skipped: products already exist.")
    return
  }

  /* ---------- магазин, канал продаж, валюты ---------- */
  const [store] = await stores.listStores()
  let [channel] = await salesChannels.listSalesChannels({ name: "Samshit web" })
  if (!channel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: "Samshit web" }] },
    })
    channel = result[0]
  }
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        name: "Samshit",
        default_sales_channel_id: channel.id,
        supported_currencies: [
          { currency_code: "usd", is_default: true },
          { currency_code: "eur" },
          { currency_code: "gel" },
        ],
      },
    },
  })

  /* ---------- регионы и налоги ---------- */
  const { result: regions } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        { name: "Georgia", currency_code: "gel", countries: GEORGIA, payment_providers: ["pp_system_default"] },
        { name: "Europe", currency_code: "eur", countries: EUROPE, payment_providers: ["pp_system_default"] },
        { name: "World", currency_code: "usd", countries: WORLD, payment_providers: ["pp_system_default"] },
      ],
    },
  })
  const region = Object.fromEntries(regions.map((r) => [r.name, r]))
  await createTaxRegionsWorkflow(container).run({
    input: [...GEORGIA, ...EUROPE, ...WORLD].map((country_code) => ({ country_code, provider_id: "tp_system" })),
  })

  /* ---------- склад: мастерская в Тбилиси ---------- */
  const { result: [workshop] } = await createStockLocationsWorkflow(container).run({
    input: { locations: [{ name: "Мастерская, Тбилиси", address: { city: "Tbilisi", country_code: "GE", address_1: "" } }] },
  })
  await updateStoresWorkflow(container).run({
    input: { selector: { id: store.id }, update: { default_location_id: workshop.id } },
  })
  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: workshop.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  })
  await linkSalesChannelsToStockLocationWorkflow(container).run({ input: { id: workshop.id, add: [channel.id] } })

  /* ---------- доставка ---------- */
  let [profile] = await fulfillment.listShippingProfiles({ type: "default" })
  if (!profile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: "Default", type: "default" }] },
    })
    profile = result[0]
  }
  const fset = await fulfillment.createFulfillmentSets({
    name: "Samshit delivery",
    type: "shipping",
    service_zones: [
      { name: "Georgia", geo_zones: GEORGIA.map((c) => ({ country_code: c, type: "country" as const })) },
      { name: "Abroad", geo_zones: [...EUROPE, ...WORLD].map((c) => ({ country_code: c, type: "country" as const })) },
    ],
  })
  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: workshop.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fset.id },
  })
  const zone = Object.fromEntries(fset.service_zones.map((z) => [z.name, z.id]))
  const rules = [
    { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
    { attribute: "is_return", value: "false", operator: "eq" as const },
  ]
  const opt = (name: string, code: string, description: string, zoneId: string, prices: { region_id: string; amount: number }[]) => ({
    name, price_type: "flat" as const, provider_id: "manual_manual", service_zone_id: zoneId, shipping_profile_id: profile.id,
    type: { label: name, description, code }, prices, rules,
  })
  await createShippingOptionsWorkflow(container).run({
    input: [
      opt("Pickup at the workshop, Tbilisi", "pickup", "Try on and adjust on the spot", zone.Georgia, [{ region_id: region.Georgia.id, amount: 0 }]),
      opt("Courier in Tbilisi", "tbilisi-courier", "Next day after the piece is ready", zone.Georgia, [{ region_id: region.Georgia.id, amount: 15 }]),
      opt("DHL Express", "dhl-express", "3–7 days after dispatch", zone.Abroad, [
        { region_id: region.Europe.id, amount: 40 },
        { region_id: region.World.id, amount: 45 },
      ]),
    ],
  })

  /* ---------- ключ витрины ---------- */
  // Свой ключ только с нашим каналом: у ключа по умолчанию уже есть стандартный канал,
  // а с двумя каналами Medusa не считает остатки («Inventory availability cannot be calculated»).
  const { result: [key] } = await createApiKeysWorkflow(container).run({
    input: { api_keys: [{ title: "Storefront", type: "publishable", created_by: "" }] },
  })
  await linkSalesChannelsToApiKeyWorkflow(container).run({ input: { id: key.id, add: [channel.id] } })

  /* ---------- категории и товары ---------- */
  const { result: cats } = await createProductCategoriesWorkflow(container).run({
    input: { product_categories: Object.values(CATEGORIES).map((c) => ({ ...c, is_active: true })) },
  })
  const catId = (code: string) => cats.find((c) => c.handle === CATEGORIES[code].handle)!.id

  const toProduct = (p: Item) => ({
    title: p.i18n.ru.title,
    handle: p.handle,
    subtitle: p.sku,
    description: p.i18n.ru.construction,
    status: ProductStatus.PUBLISHED,
    shipping_profile_id: profile.id,
    category_ids: [catId(p.category)],
    // относительные пути: витрина проксирует /static в бэкенд, админка живёт на домене бэкенда
    images: p.images.map((f) => ({ url: `/static/${f}` })),
    thumbnail: `/static/${p.images[0]}`,
    metadata: {
      sku_base: p.sku,
      lead_days: p.lead_days,
      edition_current: p.edition?.current ?? null,
      edition_total: p.edition?.total ?? null,
      preorder_from: p.preorder_from,
      i18n: p.i18n,
      placeholder: true,
    },
    options: [{ title: "Size", values: [...SIZES, "MTM"] }],
    variants: [
      ...SIZES.map((s) => ({
        title: s,
        sku: `${p.sku}-${s}`,
        options: { Size: s },
        manage_inventory: true,
        allow_backorder: true,
        prices: priceSet(p.price_usd),
      })),
      ...(p.preorder_from
        ? []
        : [{
            title: "MTM",
            sku: `${p.sku}-MTM`,
            options: { Size: "MTM" },
            manage_inventory: false,
            prices: priceSet(p.price_usd + MTM_SURCHARGE_USD),
          }]),
    ],
    sales_channels: [{ id: channel.id }],
  })
  // у предзаказа нет варианта MTM, значит у опции нет значения MTM
  const productsInput = catalog.map((p) => {
    const prod = toProduct(p)
    if (p.preorder_from) prod.options = [{ title: "Size", values: [...SIZES] }]
    return prod
  })
  await createProductsWorkflow(container).run({ input: { products: productsInput } })

  /* ---------- остатки ---------- */
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["sku", "manage_inventory", "inventory_items.inventory_item_id"],
  })
  const stockBySku = new Map<string, number>()
  for (const p of catalog) for (const s of SIZES) stockBySku.set(`${p.sku}-${s}`, (p.stock as Record<string, number>)[s] ?? 0)
  const levels: CreateInventoryLevelInput[] = []
  for (const v of variants) {
    if (!v.manage_inventory) continue
    for (const ii of v.inventory_items ?? []) {
      levels.push({ location_id: workshop.id, inventory_item_id: ii!.inventory_item_id, stocked_quantity: stockBySku.get(v.sku!) ?? 0 })
    }
  }
  await createInventoryLevelsWorkflow(container).run({ input: { inventory_levels: levels } })

  logger.info(`Seed done: ${catalog.length} products, ${levels.length} inventory levels.`)
  logger.info(`Publishable key: ${key.token}`)
}
