import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import type { HttpTypes } from "@medusajs/types"
import { sdk } from "./medusa"

export const AUTH_COOKIE = "samshit_jwt"
export const WISHLIST_COOKIE = "wishlist"
export const COOKIE = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 }

export async function authHeaders(): Promise<Record<string, string>> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value
  return token ? { authorization: `Bearer ${token}` } : {}
}

export type CustomerMeta = { locale?: string; newsletter?: boolean; wishlist?: string[]; cart_id?: string; messenger?: string }

/** Покупатель по токену из cookie; просроченный или чужой токен — как будто не вошёл. */
export const getCustomer = cache(async (): Promise<(HttpTypes.StoreCustomer & { metadata: CustomerMeta | null }) | null> => {
  const headers = await authHeaders()
  if (!headers.authorization) return null
  try {
    const { customer } = await sdk.store.customer.retrieve({ fields: "id,email,first_name,last_name,phone,metadata" }, headers)
    return customer as HttpTypes.StoreCustomer & { metadata: CustomerMeta | null }
  } catch (e) {
    if ((e as { status?: number }).status === 401) return null
    throw e
  }
})

const sanitize = (list: unknown): string[] =>
  Array.isArray(list) ? [...new Set(list.filter((h): h is string => typeof h === "string" && /^[a-z0-9-]{1,80}$/.test(h)))].slice(0, 100) : []

export async function guestWishlist() {
  try {
    return sanitize(JSON.parse((await cookies()).get(WISHLIST_COOKIE)?.value ?? "[]"))
  } catch {
    return []
  }
}

/** Избранное: у вошедшего — в профиле Medusa, у гостя — в cookie. Хранятся handle товаров. */
export async function getWishlist(customer?: Awaited<ReturnType<typeof getCustomer>>) {
  const c = customer === undefined ? await getCustomer() : customer
  return c ? sanitize(c.metadata?.wishlist) : guestWishlist()
}

export { sanitize as sanitizeWishlist }
