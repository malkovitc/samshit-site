import test from "node:test"
import assert from "node:assert/strict"
import { collectPages, newestProducts, visibleProduct } from "../catalog-list.ts"

test("collectPages includes the 101st product", async () => {
  const offsets = []
  const products = await collectPages(async (offset, limit) => {
    offsets.push(offset)
    return Array.from({ length: Math.max(0, Math.min(limit, 101 - offset)) }, (_, i) => ({ id: offset + i }))
  }, 100)
  assert.equal(products.length, 101)
  assert.deepEqual(offsets, [0, 100])
})

test("newestProducts chooses the four most recently created products", () => {
  const products = [5, 2, 4, 1, 3].map((n) => ({ id: n, createdAt: `2026-11-${String(n).padStart(2, "0")}` }))
  assert.deepEqual(newestProducts(products).map((p) => p.id), [5, 4, 3, 2])
})

test("owner drafts stay hidden even if published through the standard Medusa screen", () => {
  assert.equal(visibleProduct({ catalog_managed: true, catalog_ready: false }), false)
  assert.equal(visibleProduct({ catalog_managed: true, catalog_ready: true }), true)
  assert.equal(visibleProduct({ placeholder: true }), true)
})
