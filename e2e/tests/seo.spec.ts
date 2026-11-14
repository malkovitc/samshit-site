import { test, expect } from "@playwright/test"

const origin = new URL(process.env.BASE_URL || "https://samshit.linza-ai.xyz").origin
const indexing = process.env.EXPECT_INDEXING === "true"

test("SEO endpoints are available while indexing is disabled", async ({ request }) => {
  const robots = await request.get("/robots.txt")
  expect(robots.status()).toBe(200)
  expect(await robots.text()).toContain("Sitemap:")
  expect(await robots.text()).toContain(`${origin}/sitemap.xml`)
  const sitemap = await request.get("/sitemap.xml")
  expect(sitemap.status()).toBe(200)
  if (indexing) expect(await sitemap.text()).toContain("/p/shield-indigo")
  else expect(await sitemap.text()).not.toContain("/p/shield-indigo")
})

test("public pages have a canonical and direct language alternates", async ({ request }) => {
  const response = await request.get("/ru/p/shield-indigo")
  const html = await response.text()
  expect(response.status()).toBe(200)
  expect(html).toMatch(indexing ? /<meta name="robots" content="index,\s*follow"/ : /<meta name="robots" content="noindex,\s*follow"/)
  const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*>/)?.[0]
  expect(canonical).toContain(`href="${origin}/ru/p/shield-indigo"`)
  expect(html).toContain('hreflang="x-default"')
  expect(html).toContain(`${origin}/en/p/shield-indigo`)
})

test("private and filtered pages stay noindex", async ({ request }) => {
  for (const path of ["/ru/account", "/ru/wishlist", "/ru/checkout", "/ru/shop?st=stock"]) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(200)
    expect(await response.text(), path).toMatch(/<meta name="robots" content="noindex,\s*follow"/)
  }
})

test("public landing pages have one heading and distinct titles", async ({ request }) => {
  const titles = new Set<string>()
  for (const path of ["/ru", "/ru/shop", "/ru/shop/jackets", "/ru/about", "/ru/workshop", "/ru/delivery", "/ru/contact"]) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(200)
    const html = await response.text()
    expect((html.match(/<h1[ >]/g) || []).length, path).toBe(1)
    const title = html.match(/<title>(.*?)<\/title>/)?.[1]
    expect(title, path).toBeTruthy()
    expect(titles.has(title!), path).toBe(false)
    titles.add(title!)
  }
})
