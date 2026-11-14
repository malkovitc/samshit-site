# Samshit SEO Indexing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Samshit store technically ready for indexing on `samshit.xyz`, while keeping indexing disabled until the real catalog and payment are ready.

**Architecture:** Centralize canonical URL and indexing policy in a small server-side SEO helper. Next.js metadata routes provide robots and sitemap; page metadata covers the three locales. A production environment flag opens public routes only after release checks. Private routes remain noindex.

**Tech Stack:** Next.js 16 App Router, next-intl 4, Medusa, Node test runner, Playwright.

## Global Constraints

- `samshit.xyz` is the owner-approved canonical domain; its DNS is currently absent.
- Current catalog prices, stock, lead times and BOG payment are placeholders; keep `ALLOW_INDEXING` off until they are real.
- Locale paths are always prefixed: `/ru`, `/en`, `/ka`.
- Sitemap includes only published products returned by `listProducts`, not account, checkout, filtered URLs or drafts.
- Do not expose credentials or cookie values in diagnostics.

---

### Task 1: URL and indexing policy

**Files:** Create `storefront/src/lib/seo.ts`; modify `storefront/src/app/[locale]/layout.tsx`, `storefront/src/i18n/routing.ts`, `deploy/docker-compose.yml`; test `storefront/src/lib/__tests__/seo.test.mjs`.

**Interfaces:** `siteOrigin(): string`, `publicUrl(locale: Locale, path?: string): string`, `pageAlternates(locale: Locale, path?: string): Metadata['alternates']`, `indexingEnabled(): boolean`, `publicRobots(): Metadata['robots']`, `privateRobots(): Metadata['robots']`.

- [ ] Write failing unit tests for canonical URLs on all three locales, no query in canonical, and disabled/enabled robots; run `cd storefront && npm run test:unit` and confirm failures.
- [ ] Implement the helper with `SITE_URL` (fallback `https://samshit.linza-ai.xyz`) and `ALLOW_INDEXING === 'true'`; use `metadataBase` in the locale layout. Set `alternateLinks: false` in next-intl routing so metadata emits final, nonredirecting `hreflang` URLs including `/en/...` as `x-default`.
- [ ] Pass `SITE_URL: ${PUBLIC_STORE_URL}` and `ALLOW_INDEXING: ${ALLOW_INDEXING:-false}` into storefront in compose; run unit tests and `npm run typecheck`.
- [ ] Commit `feat: centralize SEO URL and indexing policy`.

### Task 2: Robots, sitemap and page metadata

**Files:** Create `storefront/src/app/robots.ts`, `storefront/src/app/sitemap.ts`; modify `storefront/src/app/[locale]/{page.tsx,shop/page.tsx,shop/[category]/page.tsx,p/[handle]/page.tsx}`, four `(info)` pages and private route pages; modify `storefront/src/lib/data.ts` if an updated timestamp is needed; test `e2e/tests/seo.spec.ts`.

**Interfaces:** Metadata routes consume Task 1 helpers; sitemap consumes `listProducts('en')` and uses its published-product filter. Page metadata consumes `pageAlternates` and `publicRobots`; private pages use `privateRobots` even when indexing is enabled.

- [ ] Add failing E2E assertions for `robots.txt` and `sitemap.xml` (200), public canonical and three locale alternates, disabled index flag, and permanent noindex on account/checkout/wishlist/order/filtered shop routes; run `cd e2e && npx playwright test tests/seo.spec.ts`.
- [ ] Add metadata routes. Return an empty sitemap while indexing is off. When enabled, include locale roots, shop, valid categories, information pages and published product handles. Set `lastModified` only from real updated timestamps.
- [ ] Add page-specific canonical and localized description/title metadata; preserve product 404 for missing/draft handles. Set filtered shop `noindex,follow` and canonical to unfiltered shop. Keep checkout/account/order paths noindex. Run focused E2E, unit and typecheck.
- [ ] Commit `feat: add crawlable sitemap and route metadata`.

### Task 3: Semantic headings and product markup

**Files:** Modify public page components for H1 and localized copy; add localized SEO strings to `storefront/messages/{ru,en,ka}.json`; create `storefront/src/lib/product-schema.ts`; test schema with `storefront/src/lib/__tests__/product-schema.test.mjs` and rendered output in `e2e/tests/seo.spec.ts`.

**Interfaces:** Product schema receives `ProductView`, `Locale` and a canonical URL. It emits valid `Product` data based on the same visible data. Omit `Offer` until real prices and a stable URL-to-currency rule exist.

- [ ] Write failing tests for one H1, unique metadata on public page types, valid JSON-LD without fabricated reviews or placeholder offers; run focused tests.
- [ ] Add H1 to home, shop, category, about, workshop, delivery and contact. Add localized descriptions without keyword stuffing. Render server-side JSON-LD only for a public product when catalog data is ready; escape `<` in serialized JSON.
- [ ] Run focused tests, typecheck and production build; commit `feat: improve semantic content and product metadata`.

### Task 4: Release verification and domain switch

**Files:** Modify `deploy/README.md` and deployment checks; amend `research/seo-indexing-audit-2026-11-14.md` with measured outcome.

**Interfaces:** `ALLOW_INDEXING` remains false until DNS, live pricing, checkout and canonical checks pass. The deployment gate requests pages without authentication and checks their HTML.

- [ ] Verify production build and E2E with indexing off; deploy technical changes on current host and assert robots/sitemap HTTP 200 while pages remain noindex.
- [ ] Configure `samshit.xyz` DNS, TLS and 301 redirects retaining path/query when access is available. Switch `PUBLIC_STORE_URL`, then check canonical/alternates on the new host.
- [ ] After owner-confirmed real catalog and production payment, set `ALLOW_INDEXING=true`, submit sitemap to Google Search Console and Bing Webmaster Tools, inspect representative URLs, and document the results. Do not claim indexing merely because sitemap was submitted.
- [ ] Commit deployment documentation and final evidence.
