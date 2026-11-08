import { expect, test } from "@playwright/test"
import { quietAnalytics } from "./helpers"

test.beforeEach(async ({ page }) => quietAnalytics(page))

test("меню раскрывается под шапкой и ведёт в каталог", async ({ page }) => {
  await page.goto("/ru")
  const nav = page.locator("nav.side")
  await expect(nav).not.toHaveClass(/open/)
  await page.locator(".burger").click()
  await expect(nav).toHaveClass(/open/)
  await expect(nav.locator(".mob-only [aria-label=Currency]")).toBeVisible()
  await nav.locator("a", { hasText: "Магазин" }).first().click()
  await expect(page).toHaveURL(/\/ru\/shop$/)
  await expect(nav).not.toHaveClass(/open/)
})

test("без горизонтальной прокрутки и без полосы быстрого добавления", async ({ page }) => {
  for (const p of ["/ru", "/ru/shop", "/ka/p/shield-indigo", "/en/checkout", "/ru/about"]) {
    await page.goto(p)
    const w = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(w, p).toBeLessThanOrEqual(page.viewportSize()!.width)
  }
  await page.goto("/ru/shop")
  await expect(page.locator(".qwrap").first()).toBeHidden()
})

test("покупка с телефона: карточка → корзина → оформление", async ({ page }) => {
  await page.goto("/ru/p/three-textures")
  await page.locator(".sizes button", { hasText: /^L$/ }).click()
  await page.locator("button.add").click()
  await expect(page.locator(".drawer")).toHaveClass(/open/, { timeout: 15_000 })
  await page.locator(".drawer a", { hasText: /Оформить/i }).click()
  await expect(page).toHaveURL(/\/ru\/checkout$/)
  await expect(page.locator(".summary")).toContainText(/три фактуры/i)
})
