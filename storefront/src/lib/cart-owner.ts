import "server-only"
import { sdk } from "./medusa"
import { authHeaders, getCustomer } from "./session"

/**
 * Закрепить корзину за вошедшим покупателем и запомнить её id в профиле.
 * Не server action: id корзины приходит только из нашей httpOnly-cookie или профиля,
 * иначе клиент мог бы перенести себе чужую корзину.
 */
export async function rememberCart(cartId: string, customer?: Awaited<ReturnType<typeof getCustomer>>) {
  const c = customer ?? (await getCustomer())
  if (!c) return
  const headers = await authHeaders()
  await sdk.store.cart.transferCart(cartId, {}, headers).catch(() => undefined) // уже его — не ошибка
  if (c.metadata?.cart_id !== cartId) {
    await sdk.store.customer.update({ metadata: { ...(c.metadata ?? {}), cart_id: cartId } }, {}, headers)
  }
}
