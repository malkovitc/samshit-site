import { expect, type APIRequestContext, type Page } from "@playwright/test"

export const API = process.env.API_URL || "https://samshit-api.linza-ai.xyz"
export const TEST_EMAIL_DOMAIN = "e2e.samshit.test"

/** Тесты не должны засорять аналитику: Umami пропускает события при umami.disabled. */
export async function quietAnalytics(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem("umami.disabled", "1") } catch {}
  })
}

export async function adminToken(request: APIRequestContext) {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) throw new Error("ADMIN_EMAIL / ADMIN_PASSWORD are required")
  const r = await request.post(`${API}/auth/user/emailpass`, { data: { email, password } })
  expect(r.ok(), "admin login").toBeTruthy()
  return (await r.json()).token as string
}

/** Отменяет все незакрытые тестовые заказы, чтобы вернуть остатки. */
export async function cancelTestOrders(request: APIRequestContext) {
  const token = await adminToken(request)
  const headers = { Authorization: `Bearer ${token}` }
  const r = await request.get(`${API}/admin/orders?fields=id,email,status&limit=100`, { headers })
  const { orders } = await r.json()
  for (const o of orders as { id: string; email: string; status: string }[]) {
    if (o.email?.endsWith(`@${TEST_EMAIL_DOMAIN}`) && o.status !== "canceled") {
      await request.post(`${API}/admin/orders/${o.id}/cancel`, { headers, data: {} })
    }
  }
}

export async function addFromProduct(page: Page, handle: string, opts: { mode?: "ready" | "size" | "measure"; size?: string } = {}) {
  await page.goto(`/en/p/${handle}`)
  if (opts.mode === "size") await page.locator(".modes button", { hasText: "In my size" }).click()
  if (opts.mode === "measure") await page.locator(".modes button", { hasText: "To my measurements" }).click()
  if (opts.size) await page.locator(".sizes button", { hasText: new RegExp(`^${opts.size}$`) }).click()
  await page.locator("button.add").click()
  await expect(page.locator(".drawer")).toHaveClass(/open/, { timeout: 15_000 })
}

export const money = (s: string) => Number(s.replace(/[^\d]/g, ""))
