import "server-only"
import type { HttpTypes } from "@medusajs/types"
import type { Locale } from "@/i18n/routing"
import { dueNow, type LineMode } from "./data"

export type CartLine = { id: string; handle: string; title: string; size: string; mode: LineMode; qty: number; total: number; img: string }
export type CartView = { id: string; currency: string; lines: CartLine[]; subtotal: number; shipping: number; total: number; due: number; count: number }

export function cartView(cart: HttpTypes.StoreCart | null, locale: Locale): CartView | null {
  if (!cart) return null
  const lines: CartLine[] = (cart.items ?? []).map((i) => {
    const meta = (i.product?.metadata ?? {}) as { i18n?: Record<string, { title: string }> }
    return {
      id: i.id,
      handle: i.product_handle ?? i.product?.handle ?? "",
      title: meta.i18n?.[locale]?.title ?? i.product_title ?? i.title,
      size: i.variant_title ?? i.variant?.title ?? "",
      mode: ((i.metadata as { mode?: LineMode } | null)?.mode ?? "stock") as LineMode,
      qty: i.quantity,
      total: i.total ?? i.subtotal ?? 0,
      img: i.thumbnail ?? "",
    }
  })
  return {
    id: cart.id,
    currency: cart.currency_code,
    lines,
    subtotal: cart.item_subtotal ?? cart.subtotal ?? 0,
    shipping: cart.shipping_total ?? 0,
    total: cart.total ?? 0,
    due: dueNow(cart),
    count: lines.reduce((s, l) => s + l.qty, 0),
  }
}
