import "server-only"
import type { HttpTypes } from "@medusajs/types"
import type { Locale } from "@/i18n/routing"
import { sdk } from "./medusa"
import { authHeaders, getCustomer } from "./session"
import type { LineMode } from "./data"

export type OrderLine = { title: string; handle: string; size: string; mode: LineMode; qty: number; total: number; img: string }
export type OrderView = { id: string; displayId: number; createdAt: string; currency: string; total: number; status: string; fulfillment: string; lines: OrderLine[] }

const FIELDS = "id,display_id,created_at,currency_code,total,status,fulfillment_status,customer_id,*items,*items.product"

function view(o: HttpTypes.StoreOrder, locale: Locale): OrderView {
  return {
    id: o.id,
    displayId: o.display_id ?? 0,
    createdAt: String(o.created_at),
    currency: o.currency_code,
    total: o.total ?? 0,
    status: o.status,
    fulfillment: o.fulfillment_status,
    lines: (o.items ?? []).map((i) => {
      const meta = (i.product?.metadata ?? {}) as { i18n?: Record<string, { title: string }> }
      return {
        title: meta.i18n?.[locale]?.title ?? i.product_title ?? i.title,
        handle: i.product_handle ?? "",
        size: i.variant_title ?? "",
        mode: ((i.metadata as { mode?: LineMode } | null)?.mode ?? "stock") as LineMode,
        qty: i.quantity,
        total: i.total ?? 0,
        img: i.thumbnail ?? "",
      }
    }),
  }
}

export async function listMyOrders(locale: Locale) {
  const headers = await authHeaders()
  if (!headers.authorization) return []
  const { orders } = await sdk.store.order.list({ fields: FIELDS, order: "-created_at", limit: 50 } as never, headers)
  return orders.map((o) => view(o, locale))
}

/** Заказ из кабинета: только свой. Чужой или несуществующий — null (страница отдаст 404). */
export async function getMyOrder(locale: Locale, id: string) {
  const customer = await getCustomer()
  if (!customer || !/^order_[A-Z0-9]+$/.test(id)) return null
  try {
    const { order } = await sdk.store.order.retrieve(id, { fields: FIELDS }, await authHeaders())
    if ((order as { customer_id?: string }).customer_id !== customer.id) return null
    return view(order as HttpTypes.StoreOrder, locale)
  } catch {
    return null
  }
}
