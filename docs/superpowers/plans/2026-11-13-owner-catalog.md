# Owner Catalog Implementation Plan

> **For agentic workers:** Execute tasks in order in the isolated worktree. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Samshit owner create, edit, and publish storefront-ready products inside Medusa Admin.

**Architecture:** Extend the existing Medusa Admin with a catalog route and authenticated backend APIs. Store products in Medusa and validate the Samshit-specific contract on the server. Update the Next.js storefront to discover new products and paginate.

**Tech Stack:** Medusa 2.22.1, React Admin extensions, TypeScript, Next.js 16, Jest, Playwright.

## Global Constraints

- Keep the current four category handles and fixed S/M/L/XL plus optional MTM model.
- Preserve existing seeded products and `/static` image URLs.
- Never rerun seed on a populated database.
- Make draft save possible with incomplete fields; enforce the full contract at publication.
- Do not deploy without a verified image-storage and backup arrangement.

---

### Task 1: Catalog contract and validation

**Files:** Create `backend/src/lib/catalog.ts` and `backend/src/lib/__tests__/catalog.unit.spec.ts`.

- [ ] Write tests for a complete product, missing translations/images/prices, invalid sizes/stock/edition, duplicate handle/SKU, and normalization of legacy metadata.
- [ ] Run the unit tests and verify they fail because the catalog module is missing.
- [ ] Implement typed parsing, normalization, and publication validation in `catalog.ts`.
- [ ] Run the focused tests and backend type check.

### Task 2: Medusa persistence and API

**Files:** Create `backend/src/lib/catalog-service.ts`, `backend/src/api/admin/samshit-products/route.ts`, `backend/src/api/admin/samshit-products/[id]/route.ts`, and `backend/src/api/admin/samshit-products/[id]/publish/route.ts`; add focused tests.

- [ ] Write failing tests for draft creation/update, reference resolution, stock levels, publication, and errors.
- [ ] Implement list/detail/create/update/publish using Medusa workflows and current Admin authentication.
- [ ] Verify the tests, Medusa build, and compatibility with seeded products.

### Task 3: Owner page in Medusa Admin

**Files:** Create `backend/src/admin/routes/samshit-products/page.tsx` and focused form components under `backend/src/admin/components/samshit-products/`.

- [ ] Add tests for form validation and draft/publish calls where practical.
- [ ] Implement list, create/edit/duplicate, image upload, field errors, save draft, and publish confirmation.
- [ ] Build Medusa Admin and inspect the generated route.

### Task 4: Storefront catalog integration

**Files:** Modify `storefront/src/lib/data.ts` and `storefront/src/app/[locale]/page.tsx`; add focused tests.

- [ ] Add failing tests for more than 100 products, draft/incomplete visibility, and newest products.
- [ ] Implement pagination and homepage New selection; preserve legacy products and URLs.
- [ ] Run storefront type check and production build.

### Task 5: Media, documentation, and end-to-end verification

**Files:** Modify `backend/medusa-config.ts`, `backend/.env.template`, `deploy/README.md`; add E2E tests under `e2e/tests/`.

- [ ] Configure optional durable object storage and document production rollout, backups, owner account creation, and product entry.
- [ ] Verify draft invisibility, publication in RU/EN/KA and USD/EUR/GEL, stock changes, existing product editing, images after restart, and 101st product listing.
- [ ] Run all relevant unit, type, build, and E2E checks; inspect diff and record any environment-dependent verification gap.
