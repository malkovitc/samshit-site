import { AbstractPaymentProvider, MedusaError, PaymentActions, PaymentSessionStatus } from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput, AuthorizePaymentOutput, CancelPaymentInput, CancelPaymentOutput, CapturePaymentInput,
  CapturePaymentOutput, DeletePaymentInput, DeletePaymentOutput, GetPaymentStatusInput, GetPaymentStatusOutput,
  InitiatePaymentInput, InitiatePaymentOutput, ProviderWebhookPayload, RefundPaymentInput, RefundPaymentOutput,
  RetrievePaymentInput, RetrievePaymentOutput, UpdatePaymentInput, UpdatePaymentOutput, WebhookActionResult,
} from "@medusajs/framework/types"
import { BogClient, type BogOptions, type BogReceipt, type BogStatus } from "./client"

type SessionData = { session_id?: string; bog_order_id?: string; redirect_url?: string; locale?: string; cart_id?: string; status?: BogStatus }

const toSession = (s: BogStatus): PaymentSessionStatus => {
  switch (s) {
    case "completed":
    case "partial_completed":
      return PaymentSessionStatus.CAPTURED
    case "blocked":
      return PaymentSessionStatus.AUTHORIZED
    case "rejected":
      return PaymentSessionStatus.ERROR
    case "refunded":
    case "refunded_partially":
    case "refund_requested":
      return PaymentSessionStatus.CAPTURED
    default:
      return PaymentSessionStatus.PENDING
  }
}

/**
 * Оплата через Bank of Georgia: заказ в банке создаётся при начале оплаты, покупатель уходит
 * на страницу банка (карта любого банка, Apple Pay, Google Pay), итог приходит подписанным колбэком
 * на /hooks/payment/bog_bog и проверяется запросом квитанции при возврате покупателя.
 */
class BogPaymentProviderService extends AbstractPaymentProvider<BogOptions> {
  static identifier = "bog"
  private client: BogClient

  constructor(container: Record<string, unknown>, options: BogOptions) {
    super(container, options)
    this.client = new BogClient(options)
  }

  static validateOptions(o: Record<string, unknown>) {
    for (const k of ["clientId", "clientSecret", "callbackUrl", "storeUrl"]) {
      if (!o[k]) throw new MedusaError(MedusaError.Types.INVALID_DATA, `BOG: option ${k} is required`)
    }
  }

  async initiatePayment({ amount, currency_code, data }: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const d = (data ?? {}) as SessionData
    if (!d.session_id) throw new MedusaError(MedusaError.Types.INVALID_DATA, "BOG: session_id missing")
    const locale = ["ru", "en", "ka"].includes(d.locale ?? "") ? d.locale! : "en"
    const order = await this.client.createOrder({ sessionId: d.session_id, amount: Number(amount), currency: currency_code, locale, cartId: d.cart_id })
    return { id: order.id, data: { ...d, locale, bog_order_id: order.id, redirect_url: order.redirectUrl, status: "created" } }
  }

  /** Сумма или валюта корзины изменились — заказ в банке создаётся заново, старый истечёт сам. */
  async updatePayment({ amount, currency_code, data }: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const res = await this.initiatePayment({ amount, currency_code, data })
    return { data: res.data }
  }

  private async status(data?: Record<string, unknown>) {
    const d = (data ?? {}) as SessionData
    if (!d.bog_order_id) return { status: PaymentSessionStatus.PENDING, data: d }
    const r = await this.client.receipt(d.bog_order_id)
    return { status: toSession(r.order_status.key), data: { ...d, status: r.order_status.key, method: r.payment_detail?.transfer_method?.key } }
  }

  async authorizePayment({ data }: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    return this.status(data)
  }

  async getPaymentStatus({ data }: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    return this.status(data)
  }

  // capture: "automatic" — банк списывает сразу, отдельного списания нет
  async capturePayment({ data }: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return { data }
  }

  async refundPayment({ amount, data }: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const d = (data ?? {}) as SessionData & { refunds?: number }
    if (!d.bog_order_id) throw new MedusaError(MedusaError.Types.INVALID_DATA, "BOG: no bank order to refund")
    const n = (d.refunds ?? 0) + 1
    await this.client.refund(d.bog_order_id, Number(amount), `${d.bog_order_id}:${n}`)
    return { data: { ...d, refunds: n } }
  }

  // неоплаченный заказ в банке истекает через ttl, отменять там нечего
  async cancelPayment({ data }: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data }
  }

  async deletePayment({ data }: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data }
  }

  async retrievePayment({ data }: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const d = (data ?? {}) as SessionData
    return d.bog_order_id ? { ...d, receipt: await this.client.receipt(d.bog_order_id) } : d
  }

  async getWebhookActionAndData({ data, rawData, headers }: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    const sig = (headers["callback-signature"] ?? headers["Callback-Signature"]) as string | undefined
    if (!this.client.verify(rawData as string | Buffer, sig)) {
      // без верной подписи колбэку не верим; статус всё равно подтянется по квитанции при возврате покупателя
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    const body = (data as { body?: BogReceipt }).body
    const session_id = body?.external_order_id
    if (!body || !session_id) return { action: PaymentActions.NOT_SUPPORTED }
    const amount = Number(body.purchase_units?.transfer_amount ?? body.purchase_units?.request_amount ?? 0)
    switch (toSession(body.order_status.key)) {
      case PaymentSessionStatus.CAPTURED:
        return body.order_status.key === "completed" ? { action: PaymentActions.SUCCESSFUL, data: { session_id, amount } } : { action: PaymentActions.NOT_SUPPORTED }
      case PaymentSessionStatus.AUTHORIZED:
        return { action: PaymentActions.AUTHORIZED, data: { session_id, amount } }
      case PaymentSessionStatus.ERROR:
        return { action: PaymentActions.FAILED, data: { session_id, amount } }
      default:
        return { action: PaymentActions.PENDING, data: { session_id, amount } }
    }
  }
}

export default BogPaymentProviderService
