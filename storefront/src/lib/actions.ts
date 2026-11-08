"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { sdk } from "./medusa"
import { CURRENCIES, type Currency, type LineMode, currentRegion, getCart, listRegions } from "./data"

const COOKIE = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 }

async function ensureCart() {
  const existing = await getCart()
  if (existing) return existing
  const region = await currentRegion()
  const { cart } = await sdk.store.cart.create({ region_id: region.id })
  ;(await cookies()).set("cart_id", cart.id, COOKIE)
  return cart
}

export async function setCurrency(currency: Currency) {
  if (!CURRENCIES.includes(currency)) return
  ;(await cookies()).set("currency", currency, { ...COOKIE, httpOnly: false })
  const cart = await getCart()
  if (cart && cart.currency_code !== currency) {
    const region = (await listRegions()).find((r) => r.currency_code === currency)
    if (region) await sdk.store.cart.update(cart.id, { region_id: region.id })
  }
  revalidatePath("/", "layout")
}

export async function addToCart(variantId: string, mode: LineMode) {
  const cart = await ensureCart()
  await sdk.store.cart.createLineItem(cart.id, { variant_id: variantId, quantity: 1, metadata: { mode } })
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function setQuantity(lineId: string, quantity: number) {
  const cart = await getCart()
  if (!cart) return
  if (quantity <= 0) await sdk.store.cart.deleteLineItem(cart.id, lineId)
  else await sdk.store.cart.updateLineItem(cart.id, lineId, { quantity })
  revalidatePath("/", "layout")
}

/** Адрес и варианты доставки для выбранной страны региона. */
export async function shippingOptionsFor(country: string) {
  const cart = await getCart()
  if (!cart) return []
  const allowed = (cart.region?.countries ?? []).map((c) => c.iso_2)
  const code = allowed.includes(country) ? country : allowed[0]
  if (cart.shipping_address?.country_code !== code) {
    await sdk.store.cart.update(cart.id, { shipping_address: { country_code: code } })
  }
  const { shipping_options } = await sdk.store.fulfillment.listCartOptions({ cart_id: cart.id })
  return shipping_options.map((o) => ({ id: o.id, name: o.name, code: (o as { type?: { code?: string } }).type?.code ?? "", amount: o.amount ?? 0 }))
}

export type PlaceOrderResult = { ok: true; orderId: string; displayId: number } | { ok: false; error: "empty" | "invalid" | "shipping" | "payment" | "complete" }

export async function placeOrder(input: {
  name: string
  email: string
  messenger: string
  country: string
  city: string
  address: string
  shippingOptionId: string
}): Promise<PlaceOrderResult> {
  const cart = await getCart()
  if (!cart?.items?.length) return { ok: false, error: "empty" }
  if (!input.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) return { ok: false, error: "invalid" }
  const [first_name, ...rest] = input.name.trim().split(/\s+/)
  const address = {
    first_name,
    last_name: rest.join(" "),
    country_code: input.country,
    city: input.city || (input.country === "ge" ? "Tbilisi" : ""),
    address_1: input.address,
    phone: input.messenger,
  }
  await sdk.store.cart.update(cart.id, {
    email: input.email,
    shipping_address: address,
    billing_address: address,
    metadata: { ...(cart.metadata ?? {}), messenger: input.messenger },
  })
  try {
    await sdk.store.cart.addShippingMethod(cart.id, { option_id: input.shippingOptionId })
  } catch {
    return { ok: false, error: "shipping" }
  }
  try {
    const { cart: fresh } = await sdk.store.cart.retrieve(cart.id)
    // Пока ручная оплата; модуль грузинского банка (BOG/TBC) встанет сюда же.
    await sdk.store.payment.initiatePaymentSession(fresh, { provider_id: "pp_system_default" })
  } catch {
    return { ok: false, error: "payment" }
  }
  const res = await sdk.store.cart.complete(cart.id)
  if (res.type !== "order") return { ok: false, error: "complete" }
  ;(await cookies()).delete("cart_id")
  revalidatePath("/", "layout")
  return { ok: true, orderId: res.order.id, displayId: res.order.display_id ?? 0 }
}
