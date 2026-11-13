import { ProductStatus } from "@medusajs/framework/utils"

export const LOCALES = ["ru", "en", "ka"] as const
export const CURRENCIES = ["usd", "eur", "gel"] as const
export const SIZES = ["S", "M", "L", "XL"] as const
export const CATEGORY_HANDLES = ["jackets", "trousers", "sweatshirts", "long-sleeves"] as const

export type Locale = (typeof LOCALES)[number]
export type Currency = (typeof CURRENCIES)[number]
export type Size = (typeof SIZES)[number]
export type CategoryHandle = (typeof CATEGORY_HANDLES)[number]
export type Prices = Record<Currency, number>
export type LocalizedText = { title: string; construction: string; material: string }
export type CatalogInput = {
  handle: string
  sku: string
  category: string
  images: string[]
  i18n: Record<Locale, LocalizedText>
  prices: Prices
  mtm_prices: Prices | null
  stock: Record<Size, number>
  lead_days: number
  edition: { current: number; total: number } | null
  preorder_from: string | null
}
export type CatalogError = { field: string; message: string }
export type PersistedVariant = {
  title: string
  sku: string | null
  manage_inventory: boolean
  allow_backorder: boolean
  prices: Prices
  inventory_item_id: string | null
  has_stock_level: boolean
}

type MedusaCatalogProduct = {
  handle?: string | null
  title?: string | null
  subtitle?: string | null
  description?: string | null
  images?: { url: string }[] | null
  thumbnail?: string | null
  categories?: { handle: string }[] | null
  metadata?: Record<string, unknown> | null
  variants?: {
    title?: string | null
    sku?: string | null
    inventory_quantity?: number | null
    prices?: { currency_code?: string | null; amount?: number | null }[] | null
  }[] | null
}

const emptyPrices = (): Prices => ({ usd: 0, eur: 0, gel: 0 })
const emptyText = (): LocalizedText => ({ title: "", construction: "", material: "" })
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0
const string = (value: unknown) => typeof value === "string" ? value.trim() : ""

export function emptyCatalog(): CatalogInput {
  return {
    handle: "", sku: "", category: "", images: [],
    i18n: { ru: emptyText(), en: emptyText(), ka: emptyText() },
    prices: emptyPrices(), mtm_prices: null,
    stock: { S: 0, M: 0, L: 0, XL: 0 },
    lead_days: 0, edition: null, preorder_from: null,
  }
}

// Keep draft inputs predictable even when an Admin client submits a partial form.
export function parseCatalog(value: unknown): CatalogInput {
  const v = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const text = v.i18n && typeof v.i18n === "object" ? v.i18n as Record<string, unknown> : {}
  const price = v.prices && typeof v.prices === "object" ? v.prices as Record<string, unknown> : {}
  const mtm = v.mtm_prices && typeof v.mtm_prices === "object" ? v.mtm_prices as Record<string, unknown> : null
  const stock = v.stock && typeof v.stock === "object" ? v.stock as Record<string, unknown> : {}
  const edition = v.edition && typeof v.edition === "object" ? v.edition as Record<string, unknown> : null
  return {
    handle: string(v.handle),
    sku: string(v.sku).toUpperCase(),
    category: string(v.category),
    images: Array.isArray(v.images) ? v.images.map(string).filter(Boolean) : [],
    i18n: Object.fromEntries(LOCALES.map((locale) => {
      const fields = text[locale] && typeof text[locale] === "object" ? text[locale] as Record<string, unknown> : {}
      return [locale, { title: string(fields.title), construction: string(fields.construction), material: string(fields.material) }]
    })) as Record<Locale, LocalizedText>,
    prices: Object.fromEntries(CURRENCIES.map((currency) => [currency, number(price[currency])])) as Prices,
    mtm_prices: mtm ? Object.fromEntries(CURRENCIES.map((currency) => [currency, number(mtm[currency])])) as Prices : null,
    stock: Object.fromEntries(SIZES.map((size) => [size, number(stock[size])])) as Record<Size, number>,
    lead_days: number(v.lead_days),
    edition: edition ? { current: number(edition.current), total: number(edition.total) } : null,
    preorder_from: string(v.preorder_from) || null,
  }
}

export function validateDraft(input: CatalogInput): CatalogError[] {
  const errors: CatalogError[] = []
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.handle)) errors.push({ field: "handle", message: "Адрес: латинские буквы, цифры и дефисы" })
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(input.sku)) errors.push({ field: "sku", message: "Артикул: латинские буквы, цифры и дефисы" })
  if (!input.i18n.ru.title) errors.push({ field: "i18n.ru.title", message: "Укажите название на русском" })
  for (const currency of CURRENCIES) {
    if (input.prices[currency] < 0) errors.push({ field: `prices.${currency}`, message: `Цена ${currency.toUpperCase()} не может быть отрицательной` })
    if (input.mtm_prices && input.mtm_prices[currency] < 0) errors.push({ field: `mtm_prices.${currency}`, message: `Цена MTM ${currency.toUpperCase()} не может быть отрицательной` })
  }
  for (const size of SIZES) {
    const quantity = input.stock[size]
    if (!Number.isInteger(quantity) || quantity < 0) errors.push({ field: `stock.${size}`, message: `Остаток ${size} должен быть целым неотрицательным числом` })
  }
  if (input.edition) {
    if (!Number.isInteger(input.edition.total) || input.edition.total <= 0) errors.push({ field: "edition.total", message: "Тираж должен быть положительным целым числом" })
    if (!Number.isInteger(input.edition.current) || input.edition.current < 0 || input.edition.current > input.edition.total) {
      errors.push({ field: "edition.current", message: "Номер изделия должен быть от 0 до общего тиража" })
    }
  }
  if (input.preorder_from) {
    const date = new Date(`${input.preorder_from}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.preorder_from) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.preorder_from) {
      errors.push({ field: "preorder_from", message: "Укажите существующую дату в формате ГГГГ-ММ-ДД" })
    }
  }
  return errors
}

export function validateCatalog(input: CatalogInput): CatalogError[] {
  const errors = validateDraft(input)
  if (!CATEGORY_HANDLES.includes(input.category as CategoryHandle)) errors.push({ field: "category", message: "Выберите категорию" })
  if (!input.images.length) errors.push({ field: "images", message: "Загрузите хотя бы одно фото" })
  input.images.forEach((url, index) => {
    if (!url.startsWith("/static/") && !/^https?:\/\//.test(url)) errors.push({ field: `images.${index}`, message: "Некорректный адрес фото" })
  })
  for (const locale of LOCALES) for (const field of ["title", "construction", "material"] as const) {
    if (!input.i18n[locale][field]) errors.push({ field: `i18n.${locale}.${field}`, message: `Заполните ${field} (${locale})` })
  }
  for (const currency of CURRENCIES) {
    if (!(input.prices[currency] > 0)) errors.push({ field: `prices.${currency}`, message: `Укажите цену ${currency.toUpperCase()}` })
    if (input.mtm_prices && (!(input.mtm_prices[currency] > 0) || input.mtm_prices[currency] < input.prices[currency])) {
      errors.push({ field: `mtm_prices.${currency}`, message: `Цена MTM в ${currency.toUpperCase()} должна быть не ниже обычной` })
    }
  }
  if (!Number.isInteger(input.lead_days) || input.lead_days <= 0) errors.push({ field: "lead_days", message: "Срок пошива должен быть положительным целым числом" })
  return errors
}

export function validatePersistedVariants(input: CatalogInput, variants: PersistedVariant[]): CatalogError[] {
  const errors: CatalogError[] = []
  for (const size of SIZES) {
    const variant = variants.find((item) => item.title === size)
    if (!variant) { errors.push({ field: `variants.${size}`, message: `Отсутствует размер ${size}` }); continue }
    if (variant.sku !== `${input.sku}-${size}`) errors.push({ field: `variants.${size}.sku`, message: `Неверный артикул размера ${size}` })
    if (!variant.manage_inventory) errors.push({ field: `variants.${size}.manage_inventory`, message: `Для размера ${size} нужен учёт остатков` })
    if (!variant.allow_backorder) errors.push({ field: `variants.${size}.allow_backorder`, message: `Для размера ${size} нужен пошив под заказ` })
    if (!variant.inventory_item_id || !variant.has_stock_level) errors.push({ field: `variants.${size}.stock`, message: `Размер ${size} не привязан к складу` })
    for (const currency of CURRENCIES) if (variant.prices[currency] !== input.prices[currency]) {
      errors.push({ field: `variants.${size}.prices.${currency}`, message: `Цена размера ${size} в ${currency.toUpperCase()} отличается от основной` })
    }
  }
  const mtm = variants.find((item) => item.title === "MTM")
  if (!!mtm !== !!input.mtm_prices) errors.push({ field: "variants.MTM", message: "Вариант MTM не соответствует настройке товара" })
  if (mtm && input.mtm_prices) {
    if (mtm.sku !== `${input.sku}-MTM`) errors.push({ field: "variants.MTM.sku", message: "Неверный артикул MTM" })
    if (mtm.manage_inventory) errors.push({ field: "variants.MTM.manage_inventory", message: "MTM не должен учитывать склад" })
    for (const currency of CURRENCIES) if (mtm.prices[currency] !== input.mtm_prices[currency]) {
      errors.push({ field: `variants.MTM.prices.${currency}`, message: `Цена MTM в ${currency.toUpperCase()} отличается от указанной` })
    }
  }
  return errors
}

const priceList = (prices: Prices) => CURRENCIES.map((currency_code) => ({ currency_code, amount: prices[currency_code] }))

export function buildProductInput(input: CatalogInput, refs: { categoryId: string; channelId: string; profileId: string }) {
  return {
    title: input.i18n.ru.title,
    handle: input.handle,
    subtitle: input.sku,
    description: input.i18n.ru.construction,
    status: ProductStatus.DRAFT,
    shipping_profile_id: refs.profileId,
    category_ids: [refs.categoryId],
    sales_channels: [{ id: refs.channelId }],
    images: input.images.map((url) => ({ url })),
    thumbnail: input.images[0] ?? null,
    metadata: {
      sku_base: input.sku,
      lead_days: input.lead_days,
      edition_current: input.edition?.current ?? null,
      edition_total: input.edition?.total ?? null,
      preorder_from: input.preorder_from,
      i18n: input.i18n,
      catalog_managed: true,
      catalog_ready: false,
    },
    options: [{ title: "Size", values: [...SIZES, ...(input.mtm_prices ? ["MTM"] : [])] }],
    variants: [
      ...SIZES.map((size) => ({
        title: size, sku: `${input.sku}-${size}`, options: { Size: size },
        manage_inventory: true, allow_backorder: true, prices: priceList(input.prices),
      })),
      ...(input.mtm_prices ? [{
        title: "MTM", sku: `${input.sku}-MTM`, options: { Size: "MTM" },
        manage_inventory: false, allow_backorder: true, prices: priceList(input.mtm_prices),
      }] : []),
    ],
  }
}

function pricesFromVariant(variant?: MedusaCatalogProduct["variants"] extends (infer T)[] | null | undefined ? T : never): Prices {
  const prices = emptyPrices()
  for (const price of variant?.prices ?? []) {
    if (CURRENCIES.includes(price.currency_code as Currency)) prices[price.currency_code as Currency] = number(price.amount)
  }
  return prices
}

export function fromMedusaProduct(product: MedusaCatalogProduct): CatalogInput {
  const meta = product.metadata ?? {}
  const i18n = meta.i18n && typeof meta.i18n === "object" ? meta.i18n as Record<string, unknown> : {}
  const first = product.variants?.find((variant) => variant.title !== "MTM")
  const mtm = product.variants?.find((variant) => variant.title === "MTM")
  return parseCatalog({
    handle: product.handle,
    sku: meta.sku_base ?? product.subtitle,
    category: product.categories?.[0]?.handle,
    images: product.images?.map((image) => image.url) ?? (product.thumbnail ? [product.thumbnail] : []),
    i18n: {
      ...i18n,
      ru: { title: product.title, construction: product.description, material: "", ...(i18n.ru as object ?? {}) },
    },
    prices: pricesFromVariant(first),
    mtm_prices: mtm ? pricesFromVariant(mtm) : null,
    stock: Object.fromEntries(SIZES.map((size) => [size, product.variants?.find((variant) => variant.title === size)?.inventory_quantity ?? 0])),
    lead_days: meta.lead_days,
    edition: meta.edition_total ? { current: meta.edition_current, total: meta.edition_total } : null,
    preorder_from: meta.preorder_from,
  })
}
