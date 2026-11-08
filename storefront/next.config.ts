import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")
const backend = process.env.MEDUSA_INTERNAL_URL || "http://localhost:9000"

const config: NextConfig = {
  output: "standalone",
  // картинки товаров хранятся в бэкенде Medusa; в базе пути вида /static/p06.jpg
  async rewrites() {
    return [{ source: "/static/:path*", destination: `${backend}/static/:path*` }]
  },
}

export default withNextIntl(config)
