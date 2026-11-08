#!/bin/sh
# Собирает страницы для GitHub Pages из src/.
# index.html — кликабельный прототип магазина, concept.html — концепция.
set -eu
cd "$(dirname "$0")"
cp src/prototype.html index.html
{
  printf '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="robots" content="noindex,nofollow">\n</head>\n<body style="margin:0">\n'
  sed 's|href="prototype.html"|href="./"|' src/concept.fragment.html
  printf '\n</body>\n</html>\n'
} > concept.html
echo built
