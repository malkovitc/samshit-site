#!/bin/sh
# E2E-прогон против живого магазина. Запускать на боксе sd-105293: ~/samshit/deploy/e2e.sh [аргументы playwright]
# Тестовые заказы (адреса @e2e.samshit.test) отменяются в конце, остатки возвращаются.
set -eu
cd "$(dirname "$0")"
ADMIN_EMAIL=$(sed -n 's/^email: //p' admin-credentials.txt | head -1)
ADMIN_PASSWORD=$(sed -n '2,3s/^password: //p' admin-credentials.txt | head -1)
exec docker run --rm --ipc=host --network host \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  -e BASE_URL="${BASE_URL:-https://samshit.linza-ai.xyz}" -e API_URL="${API_URL:-https://samshit-api.linza-ai.xyz}" \
  -v "$(cd ../e2e && pwd)":/e2e -w /e2e \
  mcr.microsoft.com/playwright:v1.64.1-noble \
  sh -c 'npm install --no-audit --no-fund --silent && npx playwright test "$@"' -- "$@"
