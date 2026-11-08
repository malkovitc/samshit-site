"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { sdk } from "./medusa"
import { AUTH_COOKIE, COOKIE, WISHLIST_COOKIE, authHeaders, getCustomer, guestWishlist, sanitizeWishlist, type CustomerMeta } from "./session"

type Fail<E extends string> = { ok: false; error: E }
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length <= 254
const localeOk = (l: string) => (["ru", "en", "ka"].includes(l) ? l : "en")

async function tokenFrom(result: unknown) {
  // sdk.auth.login отдаёт токен строкой; объект — это сторонний вход (редирект), у нас его нет
  if (typeof result !== "string") throw new Error("unexpected_auth_flow")
  ;(await cookies()).set(AUTH_COOKIE, result, { ...COOKIE, maxAge: 60 * 60 * 24 * 7 })
  return result
}

/**
 * После входа: избранное гостя переносится в профиль, гостевая корзина закрепляется за покупателем,
 * а если гостевой нет — восстанавливается сохранённая. Токен передаётся явно: только что записанную
 * cookie в том же запросе читать ненадёжно, а getCustomer закеширован на запрос.
 */
async function afterSignIn(token: string) {
  const jar = await cookies()
  const headers = { authorization: `Bearer ${token}` }
  const { customer } = await sdk.store.customer.retrieve({ fields: "id,metadata" }, headers)
  const meta = (customer.metadata ?? {}) as CustomerMeta
  const wishlist = sanitizeWishlist([...(meta.wishlist ?? []), ...(await guestWishlist())])
  const guestCart = jar.get("cart_id")?.value
  let cartId = meta.cart_id || ""
  if (guestCart) {
    await sdk.store.cart.transferCart(guestCart, {}, headers).catch(() => undefined)
    cartId = guestCart
  } else if (cartId) {
    try {
      const { cart } = await sdk.store.cart.retrieve(cartId, { fields: "id,completed_at" }, headers)
      if (cart.completed_at) cartId = ""
      else jar.set("cart_id", cart.id, COOKIE)
    } catch {
      cartId = ""
    }
  }
  await sdk.store.customer.update({ metadata: { ...meta, wishlist, cart_id: cartId } }, {}, headers)
  jar.delete(WISHLIST_COOKIE)
}

export async function signIn(input: { email: string; password: string }): Promise<{ ok: true } | Fail<"invalid" | "credentials">> {
  const email = input.email.trim().toLowerCase()
  if (!emailOk(email) || !input.password) return { ok: false, error: "invalid" }
  let token: string
  try {
    token = await tokenFrom(await sdk.auth.login("customer", "emailpass", { email, password: input.password }))
  } catch {
    return { ok: false, error: "credentials" }
  }
  await afterSignIn(token)
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function register(input: { name: string; email: string; password: string; newsletter: boolean; locale: string }): Promise<{ ok: true } | Fail<"invalid" | "short" | "exists" | "failed">> {
  const email = input.email.trim().toLowerCase()
  if (!emailOk(email) || !input.name.trim()) return { ok: false, error: "invalid" }
  if (input.password.length < 8) return { ok: false, error: "short" }
  let regToken: string
  try {
    regToken = await sdk.auth.register("customer", "emailpass", { email, password: input.password })
  } catch {
    // Medusa отвечает так же на занятый адрес; отдельный код помогает покупателю, но не раскрывает пароль
    return { ok: false, error: "exists" }
  }
  const [first_name, ...rest] = input.name.trim().split(/\s+/)
  let token: string
  try {
    await sdk.store.customer.create(
      { email, first_name, last_name: rest.join(" "), metadata: { locale: localeOk(input.locale), newsletter: !!input.newsletter } },
      {},
      { authorization: `Bearer ${regToken}` },
    )
    token = await tokenFrom(await sdk.auth.login("customer", "emailpass", { email, password: input.password }))
  } catch {
    return { ok: false, error: "failed" }
  }
  await afterSignIn(token)
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function signOut() {
  const jar = await cookies()
  jar.delete(AUTH_COOKIE)
  jar.delete("cart_id") // корзина остаётся в профиле и вернётся при следующем входе
  revalidatePath("/", "layout")
}

export async function toggleWishlist(handle: string): Promise<{ inList: boolean }> {
  const [h] = sanitizeWishlist([handle])
  if (!h) return { inList: false }
  const customer = await getCustomer()
  const current = customer ? sanitizeWishlist(customer.metadata?.wishlist) : await guestWishlist()
  const inList = !current.includes(h)
  const next = inList ? [h, ...current] : current.filter((x) => x !== h)
  if (customer) {
    await sdk.store.customer.update({ metadata: { ...(customer.metadata ?? {}), wishlist: next } }, {}, await authHeaders())
  } else {
    ;(await cookies()).set(WISHLIST_COOKIE, JSON.stringify(next), { ...COOKIE, httpOnly: false })
  }
  revalidatePath("/", "layout")
  return { inList }
}

export async function updateProfile(input: { name: string; messenger: string }): Promise<{ ok: boolean }> {
  const customer = await getCustomer()
  if (!customer || !input.name.trim()) return { ok: false }
  const [first_name, ...rest] = input.name.trim().split(/\s+/)
  await sdk.store.customer.update(
    { first_name, last_name: rest.join(" "), metadata: { ...(customer.metadata ?? {}), messenger: input.messenger.slice(0, 80) } },
    {},
    await authHeaders(),
  )
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function subscribeNewsletter(email: string, locale: string, source = "footer"): Promise<{ ok: boolean }> {
  if (!emailOk(email.trim())) return { ok: false }
  try {
    await sdk.client.fetch("/store/newsletter", { method: "POST", body: { email: email.trim(), locale: localeOk(locale), source } })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function unsubscribeNewsletter(token: string): Promise<{ ok: boolean }> {
  try {
    await sdk.client.fetch("/store/newsletter/unsubscribe", { method: "POST", body: { token } })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
