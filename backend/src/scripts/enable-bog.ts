import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Включает оплату Bank of Georgia (pp_bog_bog) во всех регионах; ручная оплата остаётся запасной.
 * Запуск: yarn medusa exec ./src/scripts/enable-bog.ts
 */
export default async function enableBog({ container }: ExecArgs) {
  const log = container.resolve(ContainerRegistrationKeys.LOGGER)
  const regions = await container.resolve(Modules.REGION).listRegions({}, { take: 50 })
  for (const r of regions) {
    await updateRegionsWorkflow(container).run({
      input: { selector: { id: r.id }, update: { payment_providers: ["pp_bog_bog", "pp_system_default"] } },
    })
    log.info(`payment providers set for ${r.name}`)
  }
}
