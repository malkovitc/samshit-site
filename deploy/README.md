# Развёртывание на sd-105293

Каталог на боксе: `/data/samshit` (клон репозитория). Секреты в `deploy/.env` (не в git).

```sh
cd /data/samshit/deploy
docker compose up -d --build postgres redis backend
docker compose exec backend yarn medusa exec ./src/scripts/seed.js   # один раз, печатает ключ витрины
docker compose exec backend yarn medusa user -e <email> -p <password>  # админ
# вписать MEDUSA_PUBLISHABLE_KEY в .env, затем
docker compose up -d --build storefront
```

Предпросмотр до публикации: `ssh -L 18000:127.0.0.1:18000 -L 19000:127.0.0.1:19000 sd-105293`,
витрина http://localhost:18000, админка http://localhost:19000/app.
