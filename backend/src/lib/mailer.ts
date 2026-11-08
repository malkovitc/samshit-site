/**
 * Отправка писем через ZAVU (тот же транспорт, что у Linza: POST /v1/messages, channel=email).
 * Пока магазин живёт на аккаунте Linza (решение владельца 08.11.2026), отдельный аккаунт — позже:
 * меняются только ZAVU_API_KEY / ZAVU_SENDER_ID.
 *
 * Зарезервированные тестовые домены (RFC 2606/6761: *.test, example.*, *.invalid, localhost)
 * не отправляются: отказы портят репутацию отправителя. Такие письма только пишутся в лог.
 */
const ZAVU_API = "https://api.zavu.dev/v1"

export type Outbound = { to: string; subject: string; text: string; html: string; idempotencyKey: string }
export type SendResult = { status: "sent" | "skipped" | "disabled" | "failed"; detail?: string }

const RESERVED = /(\.test|\.invalid|\.localhost|\.example)$|^example\.(com|net|org)$/i

export function isReservedAddress(email: string) {
  const domain = email.split("@").pop()?.toLowerCase() ?? ""
  return RESERVED.test(domain)
}

export async function sendEmail(msg: Outbound, log: { info: (m: string) => void; warn: (m: string) => void }): Promise<SendResult> {
  if (isReservedAddress(msg.to)) {
    log.info(`[mail] skipped reserved address: ${msg.subject}`)
    return { status: "skipped" }
  }
  const key = process.env.ZAVU_API_KEY
  if (!key) {
    log.warn(`[mail] ZAVU_API_KEY is not set, email not sent: ${msg.subject}`)
    return { status: "disabled" }
  }
  const sender = process.env.ZAVU_SENDER_ID
  const res = await fetch(`${ZAVU_API}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(sender ? { "Zavu-Sender": sender } : {}),
    },
    body: JSON.stringify({
      to: msg.to,
      channel: "email",
      subject: msg.subject,
      text: msg.text,
      htmlBody: msg.html,
      ...(process.env.MAIL_REPLY_TO ? { replyTo: process.env.MAIL_REPLY_TO } : {}),
      idempotencyKey: msg.idempotencyKey,
    }),
  })
  // 409 — письмо с этим ключом уже отправлено: повтор не дублирует
  if (res.status === 200 || res.status === 202 || res.status === 409) {
    const body = (await res.json().catch(() => ({}))) as { message?: { status?: string } }
    if (body.message?.status === "failed") {
      log.warn(`[mail] provider failed: ${msg.subject}`)
      return { status: "failed", detail: "provider_failed" }
    }
    return { status: "sent" }
  }
  log.warn(`[mail] HTTP ${res.status}: ${msg.subject}`)
  return { status: "failed", detail: `http_${res.status}` }
}
