#!/bin/sh
# Миграции перед стартом; картинки заглушек кладём в том static, если их там нет.
set -e
mkdir -p static
cp -n static-seed/* static/ 2>/dev/null || true
yarn medusa db:migrate
exec "$@"
