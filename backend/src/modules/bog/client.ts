import { createHash, createVerify } from "crypto"

/**
 * Клиент Bank of Georgia Payments API (https://api.bog.ge/docs/en/payments/introduction).
 * Страница оплаты банка сама показывает карту любого банка (Visa, Mastercard, Amex), Apple Pay и Google Pay,
 * если способы включены для мерчанта. Суммы — в основных единицах валюты (GEL, USD, EUR, GBP).
 */
export type BogOptions = {
  clientId: string
  clientSecret: string
  /** https://api.bog.ge/payments/v1 */
  apiUrl?: string
  /** https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token */
  oauthUrl?: string
  /** публичный ключ подписи колбэков; по умолчанию опубликованный ключ банка */
  publicKey?: string
  /** адрес, куда банк шлёт колбэк: https://<api>/hooks/payment/bog_bog */
  callbackUrl: string
  /** витрина, куда банк возвращает покупателя */
  storeUrl: string
}

export type BogStatus =
  | "created" | "processing" | "completed" | "rejected" | "refund_requested" | "refunded"
  | "refunded_partially" | "auth_requested" | "blocked" | "partial_completed"

export type BogReceipt = {
  order_id: string
  external_order_id?: string
  order_status: { key: BogStatus; value?: string }
  purchase_units?: { request_amount?: string | number; transfer_amount?: string | number; currency_code?: string }
  payment_detail?: { transfer_method?: { key?: string }; code?: string; code_description?: string }
}

// Опубликован на https://api.bog.ge/docs/en/payments/standard-process/callback
export const BOG_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu4RUyAw3+CdkS3ZNILQh
zHI9Hemo+vKB9U2BSabppkKjzjjkf+0Sm76hSMiu/HFtYhqWOESryoCDJoqffY0Q
1VNt25aTxbj068QNUtnxQ7KQVLA+pG0smf+EBWlS1vBEAFbIas9d8c9b9sSEkTrr
TYQ90WIM8bGB6S/KLVoT1a7SnzabjoLc5Qf/SLDG5fu8dH8zckyeYKdRKSBJKvhx
tcBuHV4f7qsynQT+f2UYbESX/TLHwT5qFWZDHZ0YUOUIvb8n7JujVSGZO9/+ll/g
4ZIWhC1MlJgPObDwRkRd8NFOopgxMcMsDIZIoLbWKhHVq67hdbwpAq9K9WMmEhPn
PwIDAQAB
-----END PUBLIC KEY-----`

/** Idempotency-Key банк ждёт в виде UUID v4; выводим его из своей строки, чтобы повтор был тем же запросом. */
export function uuidFrom(seed: string) {
  const h = createHash("sha256").update(seed).digest("hex")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

export class BogClient {
  private token?: { value: string; until: number }

  constructor(private o: BogOptions) {}

  private get api() {
    return this.o.apiUrl || "https://api.bog.ge/payments/v1"
  }

  private async auth() {
    if (this.token && this.token.until > Date.now()) return this.token.value
    const r = await fetch(this.o.oauthUrl || "https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${this.o.clientId}:${this.o.clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    })
    if (!r.ok) throw new Error(`BOG auth ${r.status}`)
    const j = (await r.json()) as { access_token: string; expires_in?: number }
    // expires_in в примерах банка бывает меткой времени, поэтому держим токен не дольше 10 минут
    const ttl = Math.min(Number(j.expires_in) || 600, 600) * 1000
    this.token = { value: j.access_token, until: Date.now() + ttl - 30_000 }
    return j.access_token
  }

  private async call<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const r = await fetch(`${this.api}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await this.auth()}`,
        "Content-Type": "application/json",
        "Accept-Language": "en",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await r.text()
    if (!r.ok) throw new Error(`BOG ${method} ${path} ${r.status}: ${text.slice(0, 300)}`)
    return (text ? JSON.parse(text) : {}) as T
  }

  async createOrder(input: { sessionId: string; amount: number; currency: string; locale: string; cartId?: string }) {
    const back = `${this.o.storeUrl}/${input.locale}/checkout/return?cart=${encodeURIComponent(input.cartId ?? "")}`
    const total = Math.round(input.amount * 100) / 100
    const res = await this.call<{ id: string; _links: { redirect: { href: string } } }>(
      "POST",
      "/ecommerce/orders",
      {
        callback_url: this.o.callbackUrl,
        // по нему колбэк находит платёжную сессию Medusa
        external_order_id: input.sessionId,
        capture: "automatic",
        ttl: 30,
        purchase_units: {
          currency: input.currency.toUpperCase(),
          total_amount: total,
          basket: [{ product_id: "samshit-order", description: "Samshit", quantity: 1, unit_price: total }],
        },
        redirect_urls: { success: back, fail: `${back}&failed=1` },
      },
      uuidFrom(`order:${input.sessionId}:${total}:${input.currency}`),
    )
    return { id: res.id, redirectUrl: res._links.redirect.href }
  }

  receipt(orderId: string) {
    return this.call<BogReceipt>("GET", `/receipt/${encodeURIComponent(orderId)}`)
  }

  refund(orderId: string, amount: number, key: string) {
    return this.call<{ key: string; action_id?: string }>("POST", `/payment/refund/${encodeURIComponent(orderId)}`, { amount: Math.round(amount * 100) / 100 }, uuidFrom(`refund:${key}`))
  }

  /** Подпись Callback-Signature: SHA256withRSA по сырому телу запроса. */
  verify(rawBody: string | Buffer, signature?: string) {
    if (!signature) return false
    try {
      return createVerify("RSA-SHA256").update(rawBody).verify(this.o.publicKey || BOG_PUBLIC_KEY, signature, "base64")
    } catch {
      return false
    }
  }
}
