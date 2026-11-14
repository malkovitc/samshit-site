import { expect, test } from "@playwright/test"
import { addFromProduct, money, quietAnalytics } from "./helpers"

test.beforeEach(async ({ page }) => quietAnalytics(page))

test.describe("языки", () => {
  test("корень ведёт на английский, у каждого языка свои подписи", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/en$/)
    for (const [l, shop, bag] of [["en", "Shop", "Bag"], ["ru", "Магазин", "Корзина"], ["ka", "მაღაზია", "კალათა"]]) {
      await page.goto(`/${l}`)
      await expect(page.locator("html")).toHaveAttribute("lang", l)
      await expect(page.locator("nav.side a").first()).toHaveText(new RegExp(shop, "i"))
      await expect(page.locator("header")).toContainText(new RegExp(bag, "i"))
    }
  })

  test("смена языка сохраняет страницу", async ({ page }) => {
    await page.goto("/en/p/race-sand")
    await page.locator("header [aria-label=Language] button", { hasText: "RU" }).click()
    await expect(page).toHaveURL(/\/ru\/p\/race-sand$/)
    await expect(page.locator("h1")).toHaveText(/Куртка RACE/i)
  })
})

test.describe("каталог", () => {
  test("12 вещей, счётчики фильтров сходятся со списком", async ({ page }) => {
    await page.goto("/en/shop")
    await expect(page.locator(".grid .card")).toHaveCount(12)
    for (const [st, label] of [["stock", "In stock"], ["mto", "Made to order"], ["pre", "Pre-order"]] as const) {
      const link = page.locator(".filters a", { hasText: label })
      const n = Number((await link.innerText()).replace(/\D/g, ""))
      await link.click()
      await expect(page).toHaveURL(new RegExp(`st=${st}`))
      await expect(page.locator(".grid .card")).toHaveCount(n)
    }
  })

  test("категория показывает только свои вещи", async ({ page }) => {
    await page.goto("/en/shop/trousers")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Trousers/i)
    const names = await page.locator(".grid .card .name").allInnerTexts()
    expect(names.length).toBeGreaterThan(0)
    for (const n of names) expect(n).toMatch(/trousers/i)
  })

  test("несуществующая категория и товар отдают 404", async ({ page }) => {
    expect((await page.goto("/en/shop/hats"))!.status()).toBe(404)
    expect((await page.goto("/en/p/no-such-piece"))!.status()).toBe(404)
  })
})

test.describe("карточка товара", () => {
  test("готовая вещь: доступны только размеры с остатком", async ({ page }) => {
    await page.goto("/en/p/race-sand")
    await expect(page.locator(".modes button[aria-pressed=true]")).toContainText(/Ready/i)
    await expect(page.locator(".sizes button", { hasText: /^M$/ })).toBeEnabled()
    for (const s of ["S", "L", "XL"]) await expect(page.locator(".sizes button", { hasText: new RegExp(`^${s}$`) })).toBeDisabled()
    await expect(page.locator("button.add")).toBeDisabled()
    await page.locator(".sizes button", { hasText: /^M$/ }).click()
    await expect(page.locator("button.add")).toBeEnabled()
    await expect(page.locator(".hint")).toContainText(/Last one/i)
  })

  test("«в моём размере» открывает все размеры, «по меркам» добавляет доплату и прячет размеры", async ({ page }) => {
    await page.goto("/en/p/race-sand")
    const base = money(await page.locator(".price").innerText())
    await page.locator(".modes button", { hasText: "In my size" }).click()
    for (const s of ["S", "M", "L", "XL"]) await expect(page.locator(".sizes button", { hasText: new RegExp(`^${s}$`) })).toBeEnabled()
    await page.locator(".modes button", { hasText: "To my measurements" }).click()
    await expect(page.locator(".sizes")).toBeHidden()
    expect(money(await page.locator(".price").innerText())).toBeGreaterThan(base)
    await expect(page.locator("button.add")).toBeEnabled()
  })

  test("предзаказ: без выбора способа, кнопка предзаказа", async ({ page }) => {
    await page.goto("/en/p/samshit-brown")
    await expect(page.locator(".modes")).toHaveCount(0)
    await page.locator(".sizes button", { hasText: /^L$/ }).click()
    await expect(page.locator("button.add .a")).toHaveText(/Pre-order · L/i)
  })

  test("галерея переключает фото, таблица размеров открывается и закрывается по Esc", async ({ page }) => {
    await page.goto("/en/p/shield-indigo")
    const img = page.locator(".stage img")
    const first = await img.getAttribute("src")
    await page.locator(".thumbs button").nth(1).click()
    await expect(img).not.toHaveAttribute("src", first!)
    await page.locator("button", { hasText: "Size chart" }).first().click()
    await expect(page.locator(".modal")).toHaveClass(/open/)
    await page.keyboard.press("Escape")
    await expect(page.locator(".modal")).not.toHaveClass(/open/)
  })
})

test.describe("корзина", () => {
  test("добавить, увеличить, уменьшить, удалить", async ({ page }) => {
    await addFromProduct(page, "membrane-olive", { mode: "size", size: "L" })
    const drawer = page.locator(".drawer")
    await expect(drawer.locator(".line")).toHaveCount(1)
    await expect(drawer.locator(".line")).toContainText(/L · in size/i)
    await expect(page.locator("header .count")).toHaveText("1")
    const one = money(await drawer.locator(".line .tn").last().innerText())

    await drawer.locator("button[aria-label='+']").click()
    await expect(drawer.locator(".qty span")).toHaveText("2")
    await expect(page.locator("header .count")).toHaveText("2")
    expect(money(await drawer.locator(".line .tn").last().innerText())).toBe(one * 2)

    await drawer.locator("button[aria-label='−']").click()
    await expect(drawer.locator(".qty span")).toHaveText("1")

    await drawer.locator("button", { hasText: /Remove/i }).click()
    await expect(drawer.locator(".empty")).toBeVisible()
    await expect(page.locator("header .count")).toHaveText("0")
  })

  test("быстрое добавление из каталога", async ({ page }) => {
    await page.goto("/en/shop")
    const card = page.locator(".card", { hasText: "Round-sleeve sweatshirt" })
    await card.hover()
    await card.locator(".quick button", { hasText: /^M$/ }).click()
    await expect(page.locator(".toast")).toHaveClass(/show/)
    await expect(page.locator("header .count")).toHaveText("1")
  })

  test("смена валюты пересчитывает и витрину, и корзину", async ({ page }) => {
    await addFromProduct(page, "cutair-grey", { size: "M" })
    await page.locator(".drawer button", { hasText: /Close/i }).click()
    await page.locator("header [aria-label=Currency] button", { hasText: "GEL" }).click()
    await expect(page.locator(".price")).toContainText("₾")
    await page.locator("header button", { hasText: /Bag/i }).click()
    await expect(page.locator(".drawer .line")).toContainText("₾")
    await page.locator(".drawer button", { hasText: /Close/i }).click() // корзина закрывает шапку справа
    await page.locator("header [aria-label=Currency] button", { hasText: "EUR" }).click()
    await expect(page.locator(".price")).toContainText("€")
  })
})
