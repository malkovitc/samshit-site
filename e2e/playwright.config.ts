import { defineConfig, devices } from "@playwright/test"

// Прогон против живого магазина. Запуск на боксе: deploy/e2e.sh
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // общая база: заказы и остатки, параллель путает счётчики
  retries: 1, // сеть бокса меняется (агенты Linza создают docker-сети): одиночный сбой — flaky, повтор — провал
  reporter: [["list"]],
  outputDir: "out/results",
  use: {
    baseURL: process.env.BASE_URL || "https://samshit.linza-ai.xyz",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec|visual\.spec/ },
  ],
})
