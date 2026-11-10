import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { routing } from "@/i18n/routing"
import { sdk } from "@/lib/medusa"
import { authHeaders } from "@/lib/session"
import { forgetCart } from "@/lib/cart-owner"

const MAX_WAIT = 10

/**
 * Возврат покупателя со страницы банка. Завершаем корзину: Medusa спрашивает у банка статус платежа
 * (провайдер bog) и создаёт заказ, только если оплата прошла. Повторное завершение уже оплаченной корзины
 * отдаёт тот же заказ, поэтому гонка с колбэком банка безопасна.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale = routing.locales.includes(raw as never) ? raw : routing.defaultLocale
  const q = req.nextUrl.searchParams
  const cartId = q.get("cart") ?? ""
  const tries = Number(q.get("n") ?? 0)
  // относительный адрес: за Caddy origin запроса внутренний (контейнер), а не публичный домен
  const to = (path: string) => new Response(null, { status: 303, headers: { Location: `/${locale}${path}`, "Cache-Control": "no-store" } })

  // корзина не с этого устройства: заказ не раскрываем, подтверждение придёт на почту
  if (!cartId || (await cookies()).get("cart_id")?.value !== cartId) return to("/checkout/wait?gone=1")

  try {
    const res = await sdk.store.cart.complete(cartId, {}, await authHeaders())
    if (res.type === "order") {
      await forgetCart(cartId)
      return to(`/order/${res.order.id}?n=${res.order.display_id ?? ""}&paid=1`)
    }
  } catch {
    // платёж ещё не подтверждён или отклонён — решаем ниже
  }
  if (q.get("failed")) return to("/checkout?pay=failed")
  if (tries >= MAX_WAIT) return to("/checkout?pay=pending")
  return to(`/checkout/wait?cart=${encodeURIComponent(cartId)}&n=${tries + 1}`)
}
