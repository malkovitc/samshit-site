"use client"

// Umami: без cookie. Скрипт подключается в layout, если заданы адрес и id сайта.
type Umami = { track: (event: string, data?: Record<string, string | number>) => void }

export function track(event: string, data?: Record<string, string | number>) {
  try {
    ;(window as unknown as { umami?: Umami }).umami?.track(event, data)
  } catch {}
}
