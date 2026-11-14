import test from "node:test"
import assert from "node:assert/strict"
import { siteOrigin, publicUrl, pageAlternates, publicRobots, privateRobots } from "../seo.ts"

test("canonical URLs use the selected origin and omit query parameters", () => {
  process.env.SITE_URL = "https://samshit.xyz/"
  assert.equal(siteOrigin(), "https://samshit.xyz")
  assert.equal(publicUrl("ru", "/shop?st=stock"), "https://samshit.xyz/ru/shop")
  assert.equal(publicUrl("ka", "/p/shield-indigo"), "https://samshit.xyz/ka/p/shield-indigo")
})

test("alternates include direct reciprocal locale URLs and a direct English fallback", () => {
  process.env.SITE_URL = "https://samshit.xyz"
  assert.deepEqual(pageAlternates("ru", "/p/shield-indigo"), {
    canonical: "https://samshit.xyz/ru/p/shield-indigo",
    languages: {
      ru: "https://samshit.xyz/ru/p/shield-indigo",
      en: "https://samshit.xyz/en/p/shield-indigo",
      ka: "https://samshit.xyz/ka/p/shield-indigo",
      "x-default": "https://samshit.xyz/en/p/shield-indigo",
    },
  })
})

test("public pages remain noindex until explicitly enabled and private pages stay noindex", () => {
  delete process.env.ALLOW_INDEXING
  assert.deepEqual(publicRobots(), { index: false, follow: true })
  assert.deepEqual(privateRobots(), { index: false, follow: true })
  process.env.ALLOW_INDEXING = "true"
  assert.deepEqual(publicRobots(), { index: true, follow: true })
  assert.deepEqual(privateRobots(), { index: false, follow: true })
  delete process.env.ALLOW_INDEXING
})
