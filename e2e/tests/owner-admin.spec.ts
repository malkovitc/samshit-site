import { expect, test } from "@playwright/test"
import { join } from "node:path"
import { API, adminToken } from "./helpers"

test.skip(process.env.CATALOG_E2E_LOCAL !== "1", "Owner Admin UI is tested against local Medusa")

test("owner can open the product form inside Medusa Admin", async ({ page }) => {
  await page.goto("http://localhost:9000/app/login")
  await page.locator('input[name="email"]').fill(process.env.ADMIN_EMAIL!)
  await page.locator('input[name="password"]').fill(process.env.ADMIN_PASSWORD!)
  await page.getByRole("button", { name: "Continue with Email" }).click()
  await expect(page).not.toHaveURL(/\/app\/login/)

  await page.goto("http://localhost:9000/app/samshit-products")
  await expect(page.getByRole("heading", { name: "Товары Самшит" })).toBeVisible()
  await page.getByRole("button", { name: "Новый товар" }).click()
  await expect(page.getByLabel("Артикул")).toBeVisible()
  await expect(page.getByRole("button", { name: "Сохранить черновик" })).toBeVisible()
})

test("owner uploads a photo and publishes a complete product through the form", async ({ page, request }) => {
  const token = await adminToken(request)
  const headers = { Authorization: `Bearer ${token}` }
  const stamp = Date.now().toString(36)
  const handle = `owner-ui-${stamp}`
  const sku = `SAM-UI-${stamp.toUpperCase()}`
  let id: string | undefined
  try {
    await page.goto("http://localhost:9000/app/login")
    await page.locator('input[name="email"]').fill(process.env.ADMIN_EMAIL!)
    await page.locator('input[name="password"]').fill(process.env.ADMIN_PASSWORD!)
    await page.getByRole("button", { name: "Continue with Email" }).click()
    await expect(page).not.toHaveURL(/\/app\/login/)
    await page.goto("http://localhost:9000/app/samshit-products")
    await page.getByRole("button", { name: "Новый товар" }).click()

    await page.getByLabel("Адрес товара").fill(handle)
    await page.getByLabel("Артикул").fill(sku)
    await page.getByLabel("Категория").selectOption("jackets")
    await page.getByLabel("Название (ru)").fill("Тестовая куртка")
    await page.getByLabel("Конструкция и особенности (ru)").fill("Крой")
    await page.getByLabel("Материал и уход (ru)").fill("Хлопок")

    await page.getByRole("button", { name: "Сохранить черновик" }).click()
    await expect(page.getByText("Черновик сохранён")).toBeVisible()
    const list = await request.get(`${API}/admin/samshit-products`, { headers })
    id = (await list.json()).products.find((product: { id: string; handle: string }) => product.handle === handle)?.id
    expect(id).toBeTruthy()

    await page.getByRole("button", { name: "Опубликовать" }).click()
    await expect(page.getByText("Исправьте поля перед сохранением или публикацией:")).toBeVisible()

    await page.getByRole("tab", { name: "English" }).click()
    await page.getByLabel("Название (en)").fill("Test jacket")
    await page.getByLabel("Конструкция и особенности (en)").fill("Cut")
    await page.getByLabel("Материал и уход (en)").fill("Cotton")
    await page.getByRole("tab", { name: "ქართული" }).click()
    await page.getByLabel("Название (ka)").fill("სატესტო ქურთუკი")
    await page.getByLabel("Конструкция и особенности (ka)").fill("ჭრა")
    await page.getByLabel("Материал и уход (ka)").fill("ბამბა")
    await page.locator('#catalog-images').setInputFiles(join(__dirname, "../../backend/static/p06.jpg"))
    await expect(page.getByAltText("Фото 1")).toBeVisible()
    await page.getByLabel("Цена USD").fill("100")
    await page.getByLabel("Цена EUR").fill("90")
    await page.getByLabel("Цена GEL").fill("270")
    await page.getByLabel("Размер M").fill("1")
    await page.getByLabel("Срок пошива, дней").fill("14")
    await page.getByRole("button", { name: "Опубликовать" }).click()
    await expect(page.getByText("Товар опубликован")).toBeVisible()

    const detail = await request.get(`${API}/admin/samshit-products/${id}`, { headers })
    const product = (await detail.json()).product
    expect(product.status).toBe("published")
    expect(product.input.images).toHaveLength(1)
    expect(product.input.prices).toEqual({ usd: 100, eur: 90, gel: 270 })
    const photo = await request.get(product.input.images[0])
    expect(photo.ok()).toBeTruthy()

    await page.getByRole("tab", { name: "Русский" }).click()
    await page.getByLabel("Название (ru)").fill("Обновлённая куртка")
    await page.getByRole("button", { name: "Обновить товар" }).click()
    await expect(page.getByText("Товар обновлён")).toBeVisible()
    const revised = await request.get(`${API}/admin/samshit-products/${id}`, { headers })
    expect((await revised.json()).product).toMatchObject({ status: "published", input: { i18n: { ru: { title: "Обновлённая куртка" } } } })
  } finally {
    if (id) await request.delete(`${API}/admin/products/${id}`, { headers })
  }
})

test("editing text during a photo upload keeps both changes", async ({ page }) => {
  await page.goto("http://localhost:9000/app/login")
  await page.locator('input[name="email"]').fill(process.env.ADMIN_EMAIL!)
  await page.locator('input[name="password"]').fill(process.env.ADMIN_PASSWORD!)
  await page.getByRole("button", { name: "Continue with Email" }).click()
  await expect(page).not.toHaveURL(/\/app\/login/)
  await page.goto("http://localhost:9000/app/samshit-products")
  await page.getByRole("button", { name: "Новый товар" }).click()
  await page.getByLabel("Название (ru)").fill("Начальное название")
  await page.route("**/admin/uploads", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await route.continue()
  })
  await page.locator("#catalog-images").setInputFiles(join(__dirname, "../../backend/static/p06.jpg"))
  await page.getByLabel("Название (ru)").fill("Название после начала загрузки")
  await expect(page.getByAltText("Фото 1")).toBeVisible()
  await expect(page.getByLabel("Название (ru)")).toHaveValue("Название после начала загрузки")
})
