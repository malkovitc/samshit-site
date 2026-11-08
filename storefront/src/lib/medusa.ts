import "server-only"
import Medusa from "@medusajs/js-sdk"

// Витрина ходит в Medusa только с сервера (серверные компоненты и server actions),
// поэтому адрес может быть внутренним адресом docker-сети.
export const sdk = new Medusa({
  baseUrl: process.env.MEDUSA_INTERNAL_URL || "http://localhost:9000",
  publishableKey: process.env.MEDUSA_PUBLISHABLE_KEY,
  debug: false,
})
