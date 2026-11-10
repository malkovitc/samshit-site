import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

/**
 * Оплата Bank of Georgia (src/modules/bog). С ключами банка — настоящий шлюз; при BOG_MOCK=true —
 * имитация банка на этом же бэкенде (src/lib/bog-mock.ts) с её собственным ключом подписи.
 */
const BOG_MOCK = process.env.BOG_MOCK === "true"
const API = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const bogProvider = () => {
  if (!BOG_MOCK && !process.env.BOG_CLIENT_ID) return []
  // ключ имитации генерируется при старте процесса, читаем его лениво из того же модуля
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mock = BOG_MOCK ? require("./src/lib/bog-mock") : null
  return [{
    resolve: "./src/modules/bog",
    id: "bog",
    options: {
      clientId: BOG_MOCK ? "mock" : process.env.BOG_CLIENT_ID,
      clientSecret: BOG_MOCK ? "mock" : process.env.BOG_CLIENT_SECRET,
      apiUrl: BOG_MOCK ? "http://localhost:9000/mock-bog" : process.env.BOG_API_URL,
      oauthUrl: BOG_MOCK ? "http://localhost:9000/mock-bog/oauth" : process.env.BOG_OAUTH_URL,
      publicKey: BOG_MOCK ? mock.mockPublicKey() : process.env.BOG_PUBLIC_KEY,
      callbackUrl: `${API}/hooks/payment/bog_bog`,
      storeUrl: process.env.STORE_URL || "https://samshit.linza-ai.xyz",
    },
  }]
}

const need = (name: string) => {
  const v = process.env[name]
  if (!v && process.env.NODE_ENV === "production") {
    throw new Error(`${name} is not set`)
  }
  return v || ""
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    // Postgres живёт в той же docker-сети и без TLS; для внешней базы выставить DATABASE_SSL=true
    databaseDriverOptions: process.env.DATABASE_SSL === "true" ? { connection: { ssl: { rejectUnauthorized: false } } } : { connection: { ssl: false } },
    redisUrl: process.env.REDIS_URL,
    workerMode: (process.env.MEDUSA_WORKER_MODE as "shared" | "worker" | "server") || "shared",
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: need("JWT_SECRET") || "dev-only-jwt",
      cookieSecret: need("COOKIE_SECRET") || "dev-only-cookie",
    },
  },
  admin: {
    // backendUrl не задаём: админка ходит в API того же домена, адрес не зашивается в сборку
    disable: process.env.DISABLE_ADMIN === "true",
  },
  modules: [
    // подписчики рассылки (src/modules/newsletter)
    { resolve: "./src/modules/newsletter" },
    { resolve: "@medusajs/medusa/payment", options: { providers: bogProvider() } },
    ...(process.env.REDIS_URL
    ? [
        { resolve: "@medusajs/medusa/event-bus-redis", options: { redisUrl: process.env.REDIS_URL } },
        { resolve: "@medusajs/medusa/workflow-engine-redis", options: { redis: { redisUrl: process.env.REDIS_URL } } },
        { resolve: "@medusajs/medusa/locking", options: { providers: [{ resolve: "@medusajs/medusa/locking-redis", id: "locking-redis", is_default: true, options: { redisUrl: process.env.REDIS_URL } }] } },
        {
          resolve: "@medusajs/medusa/file",
          options: {
            providers: [{
              resolve: "@medusajs/medusa/file-local",
              id: "local",
              options: { upload_dir: "static", backend_url: `${process.env.MEDUSA_BACKEND_URL}/static` },
            }],
          },
        },
      ]
    : []),
  ],
})
