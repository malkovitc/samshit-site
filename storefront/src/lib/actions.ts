"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { sdk } from "./medusa"
import { CURRENCIES, type Currency, type LineMode, currentRegion, getCart, listRegions } from "./data"
import { COOKIE, authHeaders, getCustomer } from "./session"
import { rememberCart } from "./cart-owner"

/**
 * Корзина вошедшего покупателя принадлежит ему: токен уходит во все вызовы корзины,
 * а id корзины сохраняется в профиле, чтобы она нашлась на другом устройстве.
 */
async function ensureCart() {
  const existing = await getCart()
  if (existing) return existing
  const region = await currentRegion()
  const headers = await authHeaders()
  const { cart } = await sdk.store.cart.create({ region_id: region.id }, {}, headers)
  ;(await cookies()).set("cart_id", cart.id, COOKIE)
  const customer = await getCustomer()
  if (customer) await rememberCart(cart.id, customer)
  return cart
}

export async function setCurrency(currency: Currency) {
  if (!CURRENCIES.includes(currency)) return
  ;(await cookies()).set("currency", currency, { ...COOKIE, httpOnly: false })
  const cart = await getCart()
  if (cart && cart.currency_code !== currency) {
    const region = (await listRegions()).find((r) => r.currency_code === currency)
    if (region) await sdk.store.cart.update(cart.id, { region_id: region.id }, {}, await authHeaders())
  }
  revalidatePath("/", "layout")
}

export async function addToCart(variantId: string, mode: LineMode) {
  const cart = await ensureCart()
  await sdk.store.cart.createLineItem(cart.id, { variant_id: variantId, quantity: 1, metadata: { mode } }, {}, await authHeaders())
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function setQuantity(lineId: string, quantity: number) {
  const cart = await getCart()
  if (!cart) return
  const headers = await authHeaders()
  if (quantity <= 0) await sdk.store.cart.deleteLineItem(cart.id, lineId, {}, headers)
  else await sdk.store.cart.updateLineItem(cart.id, lineId, { quantity }, {}, headers)
  revalidatePath("/", "layout")
}

/**
 * Варианты доставки для страны. Если страна из другого региона (например, Германия при ценах в USD),
 * корзина переезжает в регион страны и его валюту: Medusa пересчитывает цены.
 */
export async function shippingOptionsFor(country: string) {
  const cart = await getCart()
  if (!cart) return { options: [], regionChanged: false }
  const headers = await authHeaders()
  let regionChanged = false
  const inCart = (cart.region?.countries ?? []).some((c) => c.iso_2 === country)
  if (!inCart) {
    const region = (await listRegions()).find((r) => r.countries?.some((c) => c.iso_2 === country))
    if (!region) return { options: [], regionChanged: false }
    await sdk.store.cart.update(cart.id, { region_id: region.id, shipping_address: { country_code: country } }, {}, headers)
    ;(await cookies()).set("currency", region.currency_code, { ...COOKIE, httpOnly: false })
    regionChanged = true
  } else if (cart.shipping_address?.country_code !== country) {
    await sdk.store.cart.update(cart.id, { shipping_address: { country_code: country } }, {}, headers)
  }
  const { shipping_options } = await sdk.store.fulfillment.listCartOptions({ cart_id: cart.id }, headers)
  const options = shipping_options.map((o) => ({ id: o.id, name: o.name, code: (o as { type?: { code?: string } }).type?.code ?? "", amount: o.amount ?? 0 }))
  if (regionChanged) revalidatePath("/", "layout")
  return { options, regionChanged }
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
  locale: string
}): Promise<PlaceOrderResult> {
  const cart = await getCart()
  if (!cart?.items?.length) return { ok: false, error: "empty" }
  if (!input.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) return { ok: false, error: "invalid" }
  const headers = await authHeaders()
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
    // язык нужен письму-подтверждению (backend/src/subscribers/order-placed.ts)
    metadata: { ...(cart.metadata ?? {}), messenger: input.messenger, locale: ["ru", "en", "ka"].includes(input.locale) ? input.locale : "en" },
  }, {}, headers)
  try {
    await sdk.store.cart.addShippingMethod(cart.id, { option_id: input.shippingOptionId }, {}, headers)
  } catch {
    return { ok: false, error: "shipping" }
  }
  try {
    const { cart: fresh } = await sdk.store.cart.retrieve(cart.id, {}, headers)
    // Пока ручная оплата; модуль грузинского банка (BOG/TBC) встанет сюда же.
    await sdk.store.payment.initiatePaymentSession(fresh, { provider_id: "pp_system_default" }, {}, headers)
  } catch {
    return { ok: false, error: "payment" }
  }
  const res = await sdk.store.cart.complete(cart.id, {}, headers)
  if (res.type !== "order") return { ok: false, error: "complete" }
  ;(await cookies()).delete("cart_id")
  const customer = await getCustomer()
  if (customer?.metadata?.cart_id === cart.id) {
    await sdk.store.customer.update({ metadata: { ...customer.metadata, cart_id: "" } }, {}, headers)
  }
  revalidatePath("/", "layout")
  return { ok: true, orderId: res.order.id, displayId: res.order.display_id ?? 0 }
}
