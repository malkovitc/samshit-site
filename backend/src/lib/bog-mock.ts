import { createSign, generateKeyPairSync, randomUUID } from "crypto"
import type { MedusaResponse } from "@medusajs/framework/http"
import type { BogStatus } from "../modules/bog/client"

/**
 * Имитация Bank of Georgia, пока у магазина нет договора эквайринга: тот же API (токен, заказ, квитанция,
 * возврат), своя страница «оплаты» и колбэк, подписанный своим ключом. Через неё проходит настоящий код
 * провайдера bog целиком. Включается только BOG_MOCK=true; с настоящими ключами банка выключить.
 */
export const BOG_MOCK = process.env.BOG_MOCK === "true"

const keys = BOG_MOCK ? generateKeyPairSync("rsa", { modulusLength: 2048 }) : null
export const mockPublicKey = () => keys!.publicKey.export({ type: "spki", format: "pem" }).toString()

type MockOrder = {
  id: string
  external_order_id: string
  callback_url: string
  redirect_urls: { success: string; fail: string }
  currency: string
  amount: number
  status: BogStatus
  method?: string
  refunded: number
  created: number
}

// в памяти процесса: имитации хватает, заказы живут до перезапуска (ttl в банке тоже 30 минут)
const orders = new Map<string, MockOrder>()

export function notFound(res: MedusaResponse) {
  res.status(404).json({ message: "Not found" })
}

export function createMockOrder(body: Record<string, any>) {
  const id = randomUUID()
  const pu = body.purchase_units ?? {}
  orders.set(id, {
    id,
    external_order_id: String(body.external_order_id ?? ""),
    callback_url: String(body.callback_url ?? ""),
    redirect_urls: body.redirect_urls ?? { success: "", fail: "" },
    currency: String(pu.currency ?? "GEL"),
    amount: Number(pu.total_amount ?? 0),
    status: "created",
    refunded: 0,
    created: Date.now(),
  })
  for (const [k, o] of orders) if (Date.now() - o.created > 86_400_000) orders.delete(k)
  return id
}

export const getMockOrder = (id: string) => orders.get(id)

export function receiptOf(o: MockOrder) {
  return {
    order_id: o.id,
    external_order_id: o.external_order_id,
    order_status: { key: o.status },
    purchase_units: { request_amount: o.amount, transfer_amount: o.status === "rejected" ? 0 : o.amount, refund_amount: o.refunded, currency_code: o.currency },
    payment_detail: { transfer_method: { key: o.method ?? "card" }, card_type: "visa", payer_identifier: "4111********1111" },
  }
}

/** Итог «оплаты»: меняем статус и шлём подписанный колбэк, как банк. */
export async function settle(o: MockOrder, result: "card" | "apple_pay" | "google_pay" | "decline") {
  o.status = result === "decline" ? "rejected" : "completed"
  o.method = result === "decline" ? "card" : result
  const raw = JSON.stringify({ event: "order_payment", zoned_request_time: new Date().toISOString(), body: receiptOf(o) })
  const signature = createSign("RSA-SHA256").update(raw).sign(keys!.privateKey, "base64")
  await fetch(o.callback_url, { method: "POST", headers: { "Content-Type": "application/json", "Callback-Signature": signature }, body: raw }).catch(() => undefined)
  return o.status === "completed" ? o.redirect_urls.success : o.redirect_urls.fail
}

export function refundMock(o: MockOrder, amount?: number) {
  const a = amount ?? o.amount - o.refunded
  o.refunded = Math.min(o.amount, o.refunded + a)
  o.status = o.refunded >= o.amount ? "refunded" : "refunded_partially"
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)

export function payPage(o: MockOrder, base: string) {
  const sum = `${o.amount.toLocaleString("en-US").replace(/,/g, " ")} ${o.currency}`
  const btn = (r: string, label: string, primary = false) =>
    `<a class="b${primary ? " p" : ""}" href="${base}/mock-bog/pay/${o.id}/${r}">${esc(label)}</a>`
  const done = o.status !== "created"
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test payment</title><link href="https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@300;500&display=swap" rel="stylesheet">
<style>
body{margin:0;background:#fff;color:#141416;font:300 13px/1.7 'Source Code Pro',Menlo,monospace}
main{max-width:420px;margin:0 auto;padding:48px 16px}
.note{border:1px solid #1f2bd8;color:#1f2bd8;padding:10px 12px;font-size:11px;letter-spacing:.04em;margin-bottom:32px}
h1{font-size:12px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;margin:0 0 4px}
.sum{font-size:22px;font-weight:300;margin:0 0 28px}
.m{color:#7a7a84;font-size:11px}
.b{display:block;border:1px solid #141416;padding:12px 14px;margin:0 0 8px;color:#141416;text-decoration:none;text-transform:uppercase;letter-spacing:.1em;font-size:11px;font-weight:500}
.b.p{background:#141416;color:#fff}.b.x{border-style:dotted;color:#7a7a84}
</style></head><body><main>
<div class="note">Test mode. This page imitates the Bank of Georgia payment page. No money is charged.</div>
<h1>Payment to Samshit</h1><p class="m">Order ${esc(o.external_order_id.slice(-10))}</p><p class="sum">${esc(sum)}</p>
${done ? `<p>Already processed: ${esc(o.status)}.</p>` : `${btn("card", "Pay by card · Visa / Mastercard / Amex", true)}${btn("apple_pay", "Apple Pay")}${btn("google_pay", "Google Pay")}<a class="b x" href="${base}/mock-bog/pay/${o.id}/decline">Decline payment</a>`}
</main></body></html>`
}
