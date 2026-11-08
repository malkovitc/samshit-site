import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

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
