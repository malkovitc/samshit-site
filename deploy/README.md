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

Обновление только витрины, не перезапуская бэкенд:

```sh
cd ~/samshit && git pull && cd deploy && docker compose up -d --build --no-deps storefront
```

Каталог на самом деле `~/samshit`. Не выкатывать во время релиза Linza: её гейт проверяет хосты магазина.

## Оплата (Bank of Georgia)

Пока нет договора эквайринга, в `.env` стоит `BOG_MOCK=true`: бэкенд сам изображает банк
(`/mock-bog/*`, страница «оплаты» с пометкой Test mode), через неё проходит настоящий код провайдера.
Когда банк выдаст ключи:

```sh
# в deploy/.env: BOG_MOCK=false, BOG_CLIENT_ID=..., BOG_CLIENT_SECRET=...
docker compose up -d --no-deps backend
docker compose exec backend yarn medusa exec ./src/scripts/enable-bog.js   # если регионы ещё без pp_bog_bog
```

В кабинете мерчанта банка включить способы: карта, Apple Pay, Google Pay. Колбэк банк шлёт на
`https://samshit-api.linza-ai.xyz/hooks/payment/bog_bog` (адрес задаётся в каждом заказе).

## Пароль сотрудника

Не через `-p` в командной строке (виден в `ps`): см. `backend/src/scripts/set-admin-password.ts`.
