import { expect, test } from "@playwright/test"
import { API, TEST_EMAIL_DOMAIN, addFromProduct, adminToken, cancelTestOrders, money, payOnBank, quietAnalytics } from "./helpers"

test.beforeEach(async ({ page }) => quietAnalytics(page))
test.afterAll(async ({ request }) => cancelTestOrders(request))

test("пустая корзина: оформление предлагает вернуться в магазин", async ({ page }) => {
  await page.goto("/en/checkout")
  await expect(page.locator(".done-box h1")).toHaveText(/empty/i)
})

test("проверки полей: имя и email обязательны, email проверяется", async ({ page }) => {
  await addFromProduct(page, "petals-clay", { mode: "size", size: "S" })
  await page.goto("/en/checkout")
  await page.locator(".co button[type=submit]").click()
  await expect(page.locator(".co .hint")).toHaveText(/name and email/i)
  await page.fill("#c-name", "E2E Buyer")
  await page.fill("#c-email", "not-an-email")
  await page.locator(".co button[type=submit]").click()
  await expect(page.locator(".co .hint")).toHaveText(/email/i)
})

test("Грузия: самовывоз бесплатно, курьер платно, к оплате вся сумма", async ({ page }) => {
  await page.goto("/en")
  await page.locator("header [aria-label=Currency] button", { hasText: "GEL" }).click()
  await expect(page.locator("header [aria-label=Currency] [aria-pressed=true]")).toHaveText("GEL")
  await addFromProduct(page, "membrane-olive", { mode: "size", size: "M" })
  await page.goto("/en/checkout")
  await expect(page.locator("#c-country")).toHaveValue("ge")
  const opts = page.locator(".opt:has(input[name=ship])")
  await expect(opts).toHaveCount(2)
  await expect(opts.first()).toContainText(/Pick up/i)
  await expect(opts.first()).toContainText(/free/i)

  const total = money(await page.locator(".summary .total .tn").innerText())
  expect(money(await page.locator(".co button[type=submit]").innerText())).toBe(total)
  await expect(page.locator(".paymarks")).toContainText(/Apple Pay · Google Pay/i)

  await opts.nth(1).click()
  await expect(page.locator(".summary .row", { hasText: /Shipping/i })).toContainText("₾")
  const total2 = money(await page.locator(".summary .total .tn").innerText())
  expect(total2).toBeGreaterThan(total)
  await expect(page.locator("#c-city")).toBeVisible() // курьеру нужен адрес
})

test("страна другого региона переводит корзину в её валюту", async ({ page }) => {
  await page.goto("/en")
  await page.locator("header [aria-label=Currency] button", { hasText: "USD" }).click()
  await addFromProduct(page, "petals-clay", { mode: "size", size: "M" })
  await page.goto("/en/checkout")
  await expect(page.locator(".summary .total")).toContainText("$")
  await page.selectOption("#c-country", "de")
  await expect(page.locator(".summary .total")).toContainText("€")
  await expect(page.locator("header [aria-label=Currency] [aria-pressed=true]")).toHaveText("EUR")
  await expect(page.locator(".opt:has(input[name=ship])").first()).toContainText(/DHL/i)
})

test("заказ доходит до Medusa, резервирует остаток, отмена его возвращает", async ({ page, request }) => {
  // RACE: в наличии один M
  await page.goto("/en/p/race-sand")
  await expect(page.locator(".st").first()).toHaveText(/In stock/i)
  await addFromProduct(page, "race-sand", { size: "M" })
  await page.goto("/en/checkout")
  const email = `buyer-${Date.now()}@${TEST_EMAIL_DOMAIN}`
  await page.fill("#c-name", "E2E Buyer")
  await page.fill("#c-email", email)
  await page.fill("#c-messenger", "@e2e")
  await page.selectOption("#c-country", "ge")
  await page.locator(".opt", { hasText: /Pick up/i }).click()
  await page.locator(".co button[type=submit]").click()
  await payOnBank(page, "card")
  await expect(page).toHaveURL(/\/en\/order\/order_.*paid=1/, { timeout: 30_000 })
  await expect(page.locator(".done-box h1")).toContainText(/#\d+/)
  await expect(page.locator(".done-box")).toContainText(/Payment received/i)
  await expect(page.locator("header .count")).toHaveText("0")

  const token = await adminToken(request)
  // фильтр email в /admin/orders не применяется — отбираем сами
  const r = await request.get(`${API}/admin/orders?limit=100&order=-created_at&fields=id,email,currency_code,metadata,*items`, { headers: { Authorization: `Bearer ${token}` } })
  const orders = ((await r.json()).orders as { email: string }[]).filter((o) => o.email === email) as any[]
  expect(orders).toHaveLength(1)
  expect(orders[0].currency_code).toBe("gel")
  expect(orders[0].items[0].metadata).toMatchObject({ mode: "stock" })

  // единственный M зарезервирован: вещь больше не «в наличии»
  await page.goto("/en/p/race-sand")
  await expect(page.locator(".st").first()).toHaveText(/Made to order/i)

  await cancelTestOrders(request)
  await page.goto("/en/p/race-sand")
  await expect(page.locator(".st").first()).toHaveText(/In stock/i)
})

test("оплата: отказ банка возвращает к оформлению, корзина цела; Apple Pay проводит заказ", async ({ page, request }) => {
  await addFromProduct(page, "petals-clay", { mode: "size", size: "L" })
  await page.goto("/en/checkout")
  const email = `pay-${Date.now()}@${TEST_EMAIL_DOMAIN}`
  await page.fill("#c-name", "E2E Buyer")
  await page.fill("#c-email", email)
  await page.selectOption("#c-country", "ge")
  await page.locator(".opt", { hasText: /Pick up/i }).click()
  const total = money(await page.locator(".summary .total .tn").innerText())
  await page.locator(".co button[type=submit]").click()
  await expect(page.locator(".sum")).toContainText(/GEL/) // банк получил ту же сумму и валюту
  expect(money(await page.locator(".sum").innerText())).toBe(total)

  await payOnBank(page, "decline")
  await expect(page).toHaveURL(/\/en\/checkout\?pay=failed/, { timeout: 30_000 })
  await expect(page.locator(".co [role=alert]")).toContainText(/did not go through/i)
  await expect(page.locator("header .count")).toHaveText("1")

  // повторная попытка: новый заказ в банке, теперь Apple Pay
  await page.fill("#c-name", "E2E Buyer")
  await page.fill("#c-email", email)
  await page.locator(".opt", { hasText: /Pick up/i }).click()
  await page.locator(".co button[type=submit]").click()
  await payOnBank(page, "apple_pay")
  await expect(page).toHaveURL(/\/en\/order\/order_/, { timeout: 30_000 })
  await expect(page.locator("header .count")).toHaveText("0")

  // в Medusa заказ оплачен (платёж захвачен), а не просто создан
  const token = await adminToken(request)
  const r = await request.get(`${API}/admin/orders?limit=50&order=-created_at&fields=id,email,payment_status,total`, { headers: { Authorization: `Bearer ${token}` } })
  const order = ((await r.json()).orders as any[]).find((o) => o.email === email)
  expect(order).toBeTruthy()
  expect(order.payment_status).toBe("captured")
  expect(Math.round(order.total)).toBe(total)
})
