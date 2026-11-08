import "server-only"
import { cookies } from "next/headers"
import type { HttpTypes } from "@medusajs/types"
import { sdk } from "./medusa"
import { authHeaders } from "./session"
import type { Locale } from "@/i18n/routing"

export const CURRENCIES = ["usd", "gel", "eur"] as const
export type Currency = (typeof CURRENCIES)[number]
export const SIZES = ["S", "M", "L", "XL"] as const

/* ---------- регион = валюта ---------- */
export async function listRegions() {
  const { regions } = await sdk.store.region.list({ fields: "id,name,currency_code,*countries" })
  return regions
}

export async function currentCurrency(): Promise<Currency> {
  const c = (await cookies()).get("currency")?.value as Currency | undefined
  return c && CURRENCIES.includes(c) ? c : "usd"
}

export async function currentRegion() {
  const [regions, cur] = await Promise.all([listRegions(), currentCurrency()])
  const region = regions.find((r) => r.currency_code === cur) ?? regions.find((r) => r.currency_code === "usd") ?? regions[0]
  if (!region) throw new Error("No regions in Medusa: run the seed")
  return region
}

/* ---------- товары ---------- */
type I18n = Record<Locale, { title: string; construction: string; material: string }>
export type ProductView = {
  id: string
  handle: string
  sku: string
  category: string
  title: string
  construction: string
  material: string
  images: string[]
  price: number
  mtmPrice: number | null
  currency: string
  leadDays: number
  edition: { current: number; total: number } | null
  preorderFrom: string | null
  stock: Record<string, number>
  variants: Record<string, string> // размер или MTM → id варианта
  status: "stock" | "mto" | "pre"
}

const FIELDS =
  "id,handle,title,subtitle,metadata,thumbnail,*images,*categories,*variants,*variants.options,+variants.inventory_quantity,*variants.calculated_price"

function toView(p: HttpTypes.StoreProduct, locale: Locale): ProductView {
  const meta = (p.metadata ?? {}) as Record<string, unknown>
  const i18n = meta.i18n as I18n | undefined
  const tr = i18n?.[locale] ?? i18n?.en
  const variants: Record<string, string> = {}
  const stock: Record<string, number> = {}
  let price = 0
  let mtmPrice: number | null = null
  let currency = "usd"
  for (const v of p.variants ?? []) {
    const size = v.title ?? ""
    variants[size] = v.id
    const amount = v.calculated_price?.calculated_amount ?? 0
    currency = v.calculated_price?.currency_code ?? currency
    if (size === "MTM") mtmPrice = amount
    else {
      price = price || amount
      stock[size] = Math.max(0, v.inventory_quantity ?? 0)
    }
  }
  const preorderFrom = (meta.preorder_from as string | null) ?? null
  const hasStock = Object.values(stock).some((n) => n > 0)
  const ed = meta.edition_total ? { current: Number(meta.edition_current ?? 0), total: Number(meta.edition_total) } : null
  return {
    id: p.id,
    handle: p.handle,
    sku: (meta.sku_base as string) ?? p.subtitle ?? "",
    category: p.categories?.[0]?.handle ?? "",
    title: tr?.title ?? p.title,
    construction: tr?.construction ?? p.description ?? "",
    material: tr?.material ?? "",
    images: (p.images ?? []).map((i) => i.url),
    price,
    mtmPrice,
    currency,
    leadDays: Number(meta.lead_days ?? 0),
    edition: ed,
    preorderFrom,
    stock,
    variants,
    status: preorderFrom ? "pre" : hasStock ? "stock" : "mto",
  }
}

export async function listProducts(locale: Locale, opts: { category?: string } = {}) {
  const region = await currentRegion()
  let category_id: string[] | undefined
  if (opts.category) {
    const { product_categories } = await sdk.store.category.list({ handle: opts.category, fields: "id" })
    if (!product_categories.length) return []
    category_id = product_categories.map((c) => c.id)
  }
  const { products } = await sdk.store.product.list({
    region_id: region.id,
    fields: FIELDS,
    limit: 100,
    order: "created_at",
    ...(category_id ? { category_id } : {}),
  })
  return products.map((p) => toView(p, locale))
}

export async function getProduct(locale: Locale, handle: string) {
  const region = await currentRegion()
  const { products } = await sdk.store.product.list({ region_id: region.id, handle, fields: FIELDS, limit: 1 })
  return products[0] ? toView(products[0], locale) : null
}

/* ---------- корзина ---------- */
export type LineMode = "stock" | "mto" | "mtm" | "pre"

export async function getCart() {
  const id = (await cookies()).get("cart_id")?.value
  if (!id) return null
  try {
    const { cart } = await sdk.store.cart.retrieve(id, {
      fields: "*items,*items.variant,*items.product,+items.metadata,*region,*region.countries,*shipping_methods,*shipping_address,email,total,subtotal,shipping_total,item_subtotal,currency_code,metadata",
    }, await authHeaders())
    return cart.completed_at ? null : cart
  } catch (e) {
    // корзины больше нет (удалена или чужая) — начнём новую; остальные ошибки не прячем,
    // иначе при недоступном бэкенде покупатель видит «корзина пуста»
    if ([401, 403, 404].includes((e as { status?: number }).status ?? 0)) return null
    throw e
  }
}

/** Доля, которую покупатель платит сейчас: 50% за то, что шьётся под него, 100% за остальное. */
export function dueNow(cart: HttpTypes.StoreCart) {
  const items = (cart.items ?? []).reduce((s, i) => {
    const mode = (i.metadata as { mode?: LineMode } | null)?.mode
    const share = mode === "mto" || mode === "mtm" ? 0.5 : 1
    return s + (i.total ?? i.subtotal ?? 0) * share
  }, 0)
  return items + (cart.shipping_total ?? 0)
}
