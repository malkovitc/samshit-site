import test from "node:test"
import assert from "node:assert/strict"
import { sitemapEntries } from "../seo-sitemap.ts"

test("disabled indexing publishes no sitemap URLs", () => {
  assert.deepEqual(sitemapEntries([{ handle: "shield-indigo", category: "jackets" }], false), [])
})

test("enabled sitemap contains localized public URLs and only populated categories", () => {
  process.env.SITE_URL = "https://samshit.xyz"
  const urls = sitemapEntries([{ handle: "shield-indigo", category: "jackets", updatedAt: "2026-11-14T00:00:00.000Z" }], true)
  const paths = urls.map((item) => item.url)
  assert.equal(paths.length, 3 * (1 + 1 + 1 + 4 + 1))
  assert.ok(paths.includes("https://samshit.xyz/ru/p/shield-indigo"))
  assert.ok(paths.includes("https://samshit.xyz/ka/shop/jackets"))
  assert.ok(!paths.some((url) => url.includes("checkout") || url.includes("account") || url.includes("?")))
  const product = urls.find((item) => item.url.endsWith("/ru/p/shield-indigo"))
  assert.equal(product.lastModified.toISOString(), "2026-11-14T00:00:00.000Z")
  assert.equal(product.alternates.languages["x-default"], "https://samshit.xyz/en/p/shield-indigo")
})

test("sitemap never advertises category paths that the storefront rejects", () => {
  process.env.SITE_URL = "https://samshit.xyz"
  const urls = sitemapEntries([{ handle: "piece", category: "unknown" }], true).map((entry) => entry.url)
  assert.ok(urls.includes("https://samshit.xyz/en/p/piece"))
  assert.ok(!urls.some((url) => url.includes("/shop/unknown")))
})
