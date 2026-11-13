import { expect, test } from "@playwright/test"
import { API, adminToken } from "./helpers"

const local = process.env.CATALOG_E2E_LOCAL === "1" && /^http:\/\/localhost:9000$/.test(API)
test.skip(!local, "Catalog mutations run only against the isolated local Medusa database")

test("owner creates a draft, fixes it, and publishes a storefront product", async ({ request, page }) => {
  const token = await adminToken(request)
  const headers = { Authorization: `Bearer ${token}` }
  const stamp = Date.now().toString(36)
  const handle = `owner-test-${stamp}`
  const sku = `SAM-TEST-${stamp.toUpperCase()}`
  const product = {
    handle, sku, category: "jackets", images: ["/static/p06.jpg"],
    i18n: {
      ru: { title: "Тестовая куртка", construction: "Крой", material: "Хлопок" },
      en: { title: "Test jacket", construction: "Cut", material: "Cotton" },
      ka: { title: "სატესტო ქურთუკი", construction: "ჭრა", material: "ბამბა" },
    },
    prices: { usd: 100, eur: 90, gel: 270 }, mtm_prices: null,
    stock: { S: 0, M: 1, L: 0, XL: 0 }, lead_days: 14,
    edition: null, preorder_from: null,
  }

  const noAuth = await request.get(`${API}/admin/samshit-products`)
  expect(noAuth.status()).toBe(401)

  const created = await request.post(`${API}/admin/samshit-products`, { headers, data: { ...product, images: [] } })
  expect(created.status(), await created.text()).toBe(201)
  const { id } = await created.json()
  try {
    const detail = await request.get(`${API}/admin/samshit-products/${id}`, { headers })
    expect(detail.ok()).toBeTruthy()
    expect((await detail.json()).product.input.stock.M).toBe(1)

    const rejected = await request.post(`${API}/admin/samshit-products/${id}/publish`, { headers, data: {} })
    expect(rejected.status()).toBe(422)
    expect((await rejected.json()).errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: "images" })]))

    const fixed = await request.post(`${API}/admin/samshit-products/${id}`, { headers, data: product })
    expect(fixed.ok(), await fixed.text()).toBeTruthy()
    const published = await request.post(`${API}/admin/samshit-products/${id}/publish`, { headers, data: {} })
    expect(published.ok(), await published.text()).toBeTruthy()

    const after = await request.get(`${API}/admin/samshit-products/${id}`, { headers })
    const record = (await after.json()).product
    expect(record.status).toBe("published")
    expect(record.input.prices).toEqual(product.prices)
    expect(record.input.stock.M).toBe(1)

    for (const [locale, title] of [["ru", "Тестовая куртка"], ["en", "Test jacket"], ["ka", "სატესტო ქურთუკი"]]) {
      await page.goto(`/${locale}/p/${handle}`)
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title)
      await expect(page.locator(".gal img").first()).toBeVisible()
    }
    await page.goto("/en")
    await expect(page.locator(".grid .card").first()).toContainText("Test jacket")
    await page.context().addCookies([{ name: "currency", value: "eur", url: "http://localhost:8000" }])
    await page.goto(`/en/p/${handle}`)
    await expect(page.locator(".price")).toContainText("€")
    await page.context().addCookies([{ name: "currency", value: "gel", url: "http://localhost:8000" }])
    await page.goto(`/en/p/${handle}`)
    await expect(page.locator(".price")).toContainText("₾")

    const duplicate = await request.post(`${API}/admin/samshit-products`, { headers, data: product })
    expect(duplicate.status()).toBe(422)
    expect((await duplicate.json()).errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: "handle" })]))

    const invalidEdit = await request.post(`${API}/admin/samshit-products/${id}/publish`, {
      headers, data: { ...product, prices: { ...product.prices, eur: 0 } },
    })
    expect(invalidEdit.status()).toBe(422)
    const missingPhoto = await request.post(`${API}/admin/samshit-products/${id}/publish`, {
      headers, data: { ...product, images: ["/static/not-present.jpg"] },
    })
    expect(missingPhoto.status()).toBe(422)
    expect((await missingPhoto.json()).errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: "images.0" })]))
    expect((await (await request.get(`${API}/admin/samshit-products/${id}`, { headers })).json()).product.status).toBe("published")

    const revised = { ...product, i18n: { ...product.i18n, ru: { ...product.i18n.ru, title: "Куртка после обновления" } } }
    const updated = await request.post(`${API}/admin/samshit-products/${id}/publish`, { headers, data: revised })
    expect(updated.ok(), await updated.text()).toBeTruthy()
    expect((await (await request.get(`${API}/admin/samshit-products/${id}`, { headers })).json()).product.status).toBe("published")
    await page.goto(`/ru/p/${handle}`)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Куртка после обновления")

    const unlinked = await request.post(`${API}/admin/products/${id}`, { headers, data: { sales_channels: [] } })
    expect(unlinked.ok(), await unlinked.text()).toBeTruthy()
    const publishWithoutChannel = await request.post(`${API}/admin/samshit-products/${id}/publish`, { headers, data: {} })
    expect(publishWithoutChannel.status()).toBe(422)
    expect((await publishWithoutChannel.json()).errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: "sales_channels" })]))
    const repaired = await request.post(`${API}/admin/samshit-products/${id}/publish`, { headers, data: revised })
    expect(repaired.ok(), await repaired.text()).toBeTruthy()
  } finally {
    await request.delete(`${API}/admin/products/${id}`, { headers })
  }
})

test("owner can edit a seeded product without replacing its variants", async ({ request }) => {
  const token = await adminToken(request)
  const headers = { Authorization: `Bearer ${token}` }
  const list = await request.get(`${API}/admin/samshit-products`, { headers })
  const seeded = (await list.json()).products.find((product: { handle: string }) => product.handle === "shield-indigo")
  expect(seeded).toBeTruthy()
  const detail = await request.get(`${API}/admin/samshit-products/${seeded.id}`, { headers })
  const before = (await detail.json()).product
  const standardBefore = await request.get(`${API}/admin/products/${seeded.id}?fields=id,*variants`, { headers })
  const originalIds = (await standardBefore.json()).product.variants.map((variant: { id: string }) => variant.id).sort()
  const changed = structuredClone(before.input)
  changed.i18n.ru.title += " (проверка)"
  try {
    const saved = await request.post(`${API}/admin/samshit-products/${seeded.id}`, { headers, data: changed })
    expect(saved.ok(), await saved.text()).toBeTruthy()
    const draft = await request.get(`${API}/admin/samshit-products/${seeded.id}`, { headers })
    expect((await draft.json()).product.status).toBe("draft")
    const published = await request.post(`${API}/admin/samshit-products/${seeded.id}/publish`, { headers, data: {} })
    expect(published.ok(), await published.text()).toBeTruthy()
    const standardAfter = await request.get(`${API}/admin/products/${seeded.id}?fields=id,*variants`, { headers })
    expect((await standardAfter.json()).product.variants.map((variant: { id: string }) => variant.id).sort()).toEqual(originalIds)
  } finally {
    const restored = await request.post(`${API}/admin/samshit-products/${seeded.id}`, { headers, data: before.input })
    expect(restored.ok(), await restored.text()).toBeTruthy()
    if (before.status === "published") {
      const published = await request.post(`${API}/admin/samshit-products/${seeded.id}/publish`, { headers, data: {} })
      expect(published.ok(), await published.text()).toBeTruthy()
    }
  }
})
