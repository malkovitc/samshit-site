import { expect, test, type Page } from "@playwright/test"
import { API, TEST_EMAIL_DOMAIN, addFromProduct, adminToken, cancelTestOrders, payOnBank, quietAnalytics } from "./helpers"

test.beforeEach(async ({ page }) => quietAnalytics(page))
test.afterAll(async ({ request }) => cancelTestOrders(request))

const PASSWORD = "e2e-Password-1"
const newEmail = (tag: string) => `${tag}-${Date.now()}@${TEST_EMAIL_DOMAIN}`

async function registerVia(page: Page, email: string, name = "E2E Buyer") {
  await page.goto("/en/account")
  await page.fill("#re-name", name)
  await page.fill("#re-email", email)
  await page.fill("#re-password", PASSWORD)
  await page.locator(".auth", { hasText: "Create an account" }).locator("button.btn").click()
  await expect(page.locator(".h span").first()).toHaveText(/Hello, E2E/i, { timeout: 20_000 })
}

/** Выход: ждём, пока шапка покажет «Sign in», иначе следующий переход оборвёт запрос выхода. */
async function signOutVia(page: Page) {
  await page.locator("button", { hasText: /Sign out/i }).click()
  await expect(page.locator("header")).toContainText(/Sign in/i, { timeout: 15_000 })
}

async function signInVia(page: Page, email: string, password = PASSWORD) {
  await page.goto("/en/account")
  await page.fill("#si-email", email)
  await page.fill("#si-password", password)
  await page.locator(".auth", { hasText: "Sign in" }).first().locator("button.btn").click()
}

test("регистрация: проверки формы и вход в кабинет", async ({ page }) => {
  await page.goto("/en/account")
  const reg = page.locator(".auth", { hasText: "Create an account" })
  await page.fill("#re-name", "E2E")
  await page.fill("#re-email", newEmail("short"))
  await page.fill("#re-password", "short")
  await page.evaluate(() => document.querySelectorAll("input[minlength]").forEach((i) => i.removeAttribute("minlength")))
  await reg.locator("button.btn").click()
  await expect(reg.locator(".hint")).toHaveText(/shorter than 8/i)

  const email = newEmail("reg")
  await registerVia(page, email)
  await expect(page.locator("header")).toContainText(/Account/i)
  await expect(page.locator(".account")).toContainText(email)
  await expect(page.locator(".account")).toContainText(/No orders yet/i)

  // повторная регистрация того же адреса
  await signOutVia(page)
  await page.fill("#re-name", "E2E")
  await page.fill("#re-email", email)
  await page.fill("#re-password", PASSWORD)
  await reg.locator("button.btn").click()
  await expect(reg.locator(".hint")).toHaveText(/already exists/i)
})

test("вход: неверный пароль не пускает", async ({ page }) => {
  const email = newEmail("pw")
  await registerVia(page, email)
  await signOutVia(page)
  await signInVia(page, email, "wrong-password")
  await expect(page.locator(".auth").first().locator(".hint")).toHaveText(/Wrong email or password/i)
})

test("избранное гостя переезжает в аккаунт и живёт после выхода и входа", async ({ page }) => {
  await page.goto("/en/p/membrane-olive")
  await page.locator("button.wish").click()
  await expect(page.locator("button.wish")).toHaveAttribute("aria-pressed", "true")
  await page.goto("/en/wishlist")
  await expect(page.locator(".grid .card")).toHaveCount(1)
  await expect(page.locator(".view")).toContainText(/lives in this browser/i)

  const email = newEmail("wish")
  await registerVia(page, email)
  await page.goto("/en/p/race-sand")
  await page.locator("button.wish").click()
  await expect(page.locator("button.wish")).toHaveAttribute("aria-pressed", "true")

  await page.goto("/en/account")
  await signOutVia(page)
  await page.goto("/en/wishlist")
  await expect(page.locator(".grid .card")).toHaveCount(0) // гостевое ушло в профиль

  await signInVia(page, email)
  await expect(page.locator(".h span").first()).toHaveText(/Hello/i)
  await page.goto("/en/wishlist")
  await expect(page.locator(".grid .card")).toHaveCount(2)

  // снять из каталога
  await page.locator(".card", { hasText: "Membrane bomber" }).locator(".heart").click()
  await expect(page.locator(".grid .card")).toHaveCount(1)
})

test("корзина: гостевая привязывается при входе и возвращается после выхода", async ({ page }) => {
  const email = newEmail("cart")
  await registerVia(page, email)
  await signOutVia(page)

  await addFromProduct(page, "petals-clay", { mode: "size", size: "M" })
  await expect(page.locator("header .count")).toHaveText("1")
  await signInVia(page, email)
  await expect(page.locator(".h span").first()).toHaveText(/Hello/i)
  await expect(page.locator("header .count")).toHaveText("1")

  await signOutVia(page)
  await expect(page.locator("header .count")).toHaveText("0") // после выхода корзины на устройстве нет

  await signInVia(page, email)
  await expect(page.locator("header .count")).toHaveText("1") // и она вернулась из профиля
})

test("заказ вошедшего: email подставлен, заказ в истории, чужой заказ не открывается", async ({ page, browser }) => {
  const email = newEmail("orders")
  await registerVia(page, email)
  await addFromProduct(page, "round-black", { size: "M" })
  await page.goto("/en/checkout")
  await expect(page.locator("#c-email")).toHaveValue(email)
  await expect(page.locator("#c-name")).toHaveValue("E2E Buyer")
  await page.selectOption("#c-country", "ge")
  await page.locator(".opt", { hasText: /Pick up/i }).click()
  await page.locator(".co button[type=submit]").click()
  await payOnBank(page, "google_pay")
  await expect(page).toHaveURL(/\/en\/order\//, { timeout: 30_000 })
  const orderId = page.url().match(/order_[A-Z0-9]+/)![0]

  await page.goto("/en/account")
  const row = page.locator(".order-row").first()
  await expect(row).toContainText(/Order #\d+/)
  await row.click()
  await expect(page).toHaveURL(new RegExp(`/en/account/orders/${orderId}$`))
  await expect(page.locator(".order-detail")).toContainText(/Round-sleeve sweatshirt/i)

  // другой покупатель по прямой ссылке получает 404
  const other = await browser.newContext()
  const p2 = await other.newPage()
  await quietAnalytics(p2)
  await registerVia(p2, newEmail("other"))
  expect((await p2.goto(`/en/account/orders/${orderId}`))!.status()).toBe(404)
  await other.close()
})

test("рассылка: подписка из подвала попадает в список, отписка по ссылке работает", async ({ page, request }) => {
  const email = newEmail("news")
  await page.goto("/ru")
  await page.fill("#subEmail", email)
  await page.locator("footer button", { hasText: /Подписаться/i }).click()
  await expect(page.locator(".toast")).toHaveText(/Спасибо/i)

  const token = await adminToken(request)
  const r = await request.get(`${API}/admin/newsletter`, { headers: { Authorization: `Bearer ${token}` } })
  const data = await r.json()
  const sub = data.subscribers.find((s: { email: string }) => s.email === email)
  expect(sub).toMatchObject({ locale: "ru", status: "subscribed", source: "footer" })

  // неправильный адрес
  await page.fill("#subEmail", "nope")
  await page.locator("footer button", { hasText: /Подписаться/i }).click()
  await expect(page.locator("footer input:invalid")).toHaveCount(1)

  // страница отписки без токена не ломается
  await page.goto("/ru/unsubscribe?token=bad-token-123")
  await page.locator(".done-box button").click()
  await expect(page.locator(".done-box")).toContainText(/Больше писем/i) // неизвестный токен не раскрывается
})

test("сброс пароля: ссылка из входа, ответ не раскрывает адрес, битая ссылка не ломает страницу", async ({ page }) => {
  await page.goto("/en/account")
  await page.locator("a", { hasText: /Forgot your password/i }).click()
  await expect(page).toHaveURL(/\/en\/account\/forgot$/)
  await page.fill("#fg-email", newEmail("nobody"))
  await page.locator(".auth button.btn").click()
  await expect(page.locator(".done-box")).toContainText(/If there is an account/i)

  await page.goto("/en/account/reset")
  await expect(page.locator(".done-box")).toContainText(/link is incomplete/i)
  await page.goto(`/en/account/reset?token=bad.token.value&email=${encodeURIComponent(newEmail("x"))}`)
  await page.fill("#rs-password", PASSWORD)
  await page.locator(".auth button.btn").click()
  await expect(page.locator(".auth .hint")).toHaveText(/expired/i)
})
