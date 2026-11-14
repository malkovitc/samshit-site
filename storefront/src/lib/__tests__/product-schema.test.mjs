import test from "node:test"
import assert from "node:assert/strict"
import { productSchema, safeJsonLd } from "../product-schema.ts"

test("product schema uses visible content and absolute images without a placeholder offer", () => {
  process.env.SITE_URL = "https://samshit.xyz"
  const schema = productSchema({
    handle: "shield-indigo", title: "Куртка Щит", construction: "Десять карманов",
    sku: "SHIELD-01", images: ["/static/p06.jpg"],
  }, "ru")
  assert.equal(schema.name, "Куртка Щит")
  assert.equal(schema.url, "https://samshit.xyz/ru/p/shield-indigo")
  assert.deepEqual(schema.image, ["https://samshit.xyz/static/p06.jpg"])
  assert.equal("offers" in schema, false)
  assert.equal("aggregateRating" in schema, false)
})

test("serialized JSON-LD cannot close its script tag", () => {
  assert.equal(safeJsonLd({ name: "</script>" }), '{"name":"\\u003c/script>"}')
})
