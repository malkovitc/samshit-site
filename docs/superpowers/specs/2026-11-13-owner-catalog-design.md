# Owner catalog in Medusa Admin

## Goal

The Samshit owner can add and edit products in a browser, save drafts, and publish only products that the storefront can display and sell correctly. Existing seeded products remain editable. This release handles products one at a time; bulk CSV import is outside its scope.

## Existing system

Medusa 2.22.1 already provides Admin authentication, product, upload, price, inventory, and sales channel APIs. The Next.js storefront reads Medusa products but expects Samshit-specific `metadata` keys: `i18n`, `sku_base`, `lead_days`, `edition_current`, `edition_total`, and `preorder_from`. It assumes four categories, S/M/L/XL variants, and optional MTM. The homepage's New section is hardcoded to four handles and product listing stops at 100 records.

## Owner workflow

Add a `Товары Самшит` page inside the existing Medusa Admin. It lists drafts and published products and supports creating, duplicating, and editing a product. The form has sections for basic details, RU/EN/KA text, images, prices in USD/EUR/GEL, sizes and stock at the Tbilisi workshop, lead time, edition, and preorder date. It offers Save draft and Publish actions. Publishing reports actionable field errors; an incomplete draft stays private.

Product creation and updates use Medusa records, workflows, and file uploads. No second product database or login is introduced. A server-side catalog service validates owner input, resolves existing category/sales-channel/stock-location/shipping-profile records, and creates or updates products with the same structure as the seed. Publishing verifies the persisted record, not just browser form state. Existing products are normalized into the same edit form. Seed is never rerun to update products.

## Data contract

- Category is exactly one of `jackets`, `trousers`, `sweatshirts`, `long-sleeves`; new categories need storefront support first.
- Handle and base SKU are unique. The four fixed sizes use SKUs `<base>-S`, `<base>-M`, `<base>-L`, `<base>-XL`. MTM, when enabled, uses `<base>-MTM`.
- Each published product has at least one image, all three localized title/construction/material groups, positive prices in all three currencies for each sellable variant, and a positive lead time.
- All four sizes have managed inventory and allow backorder, so zero stock means made to order. MTM has no managed inventory. Stock quantities are nonnegative integers at the Tbilisi workshop.
- Edition values are optional; when present, total is positive and current is between zero and total. `preorder_from` keeps its current meaning: a displayed preorder date, with purchase permitted now.
- Drafts may be incomplete. A publish action marks the product ready only after server validation. The storefront does not surface newly created incomplete products. Existing seeded products retain their current visibility until edited.

## Storefront and media

The storefront reads the same Medusa products and supports legacy `/static/...` and new uploaded-image URLs. The homepage New section uses the newest four published products. Product lists paginate beyond 100. The current local file provider and persistent Docker volume remain functional for development; production upload storage must be configured for durable object storage before owner rollout, or the static volume must be backed up and restore-tested.

## Errors and verification

Validation errors identify the exact field. Duplicate handle/SKU, missing reference records, and failed image upload do not publish a product. Tests cover validation, draft visibility, publication across languages and currencies, inventory behavior, editing seeded products, persistence after rebuild, and catalog pagination. Existing checkout tests must continue to pass.

## Access

The owner receives a separate Medusa Admin user account. Custom `/admin` endpoints remain authenticated. Product-only RBAC is not assumed because Medusa documents it as an Enterprise feature; access to this Admin installation is treated as full Admin access unless a separately licensed role system is enabled.
