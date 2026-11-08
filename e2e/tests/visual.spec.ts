import { test } from "@playwright/test"
import { addFromProduct, quietAnalytics } from "./helpers"

// Снимки всех экранов для ручного ревью визуала (не сравнение с эталоном).
const PAGES = [
  ["home", "/ru"], ["shop", "/ru/shop"], ["category", "/ru/shop/jackets"],
  ["product", "/ru/p/shield-indigo"], ["product-pre", "/ru/p/samshit-brown"], ["product-ka", "/ka/p/race-sand"],
  ["workshop", "/ru/workshop"], ["about", "/ru/about"], ["delivery", "/ru/delivery"], ["contact", "/ru/contact"],
  ["empty-checkout", "/ru/checkout"], ["404", "/ru/p/nope"],
] as const

for (const scheme of ["light", "dark"] as const) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme })
    test.beforeEach(async ({ page }) => quietAnalytics(page))

    for (const [name, path] of PAGES) {
      test(`снимок ${name}`, async ({ page }, info) => {
        await page.goto(path)
        await page.waitForLoadState("networkidle")
        await page.waitForTimeout(900) // анимации появления
        await page.screenshot({ path: `out/shots/${info.project.name}-${scheme}-${name}.png`, fullPage: true })
      })
    }

    test("снимок корзины и оформления", async ({ page }, info) => {
      await addFromProduct(page, "race-sand", { mode: "measure" })
      await page.waitForTimeout(700)
      await page.screenshot({ path: `out/shots/${info.project.name}-${scheme}-cart.png` })
      await page.goto("/ru/checkout")
      await page.waitForLoadState("networkidle")
      await page.screenshot({ path: `out/shots/${info.project.name}-${scheme}-checkout.png`, fullPage: true })
    })
  })
}
