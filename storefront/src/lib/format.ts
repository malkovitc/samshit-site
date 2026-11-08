const SIGN: Record<string, string> = { usd: "$", gel: "₾", eur: "€" }
const LOCALE: Record<string, string> = { ru: "ru-RU", en: "en-US", ka: "ka-GE" }

export function money(amount: number, currency: string, locale: string) {
  const v = Math.round(amount).toLocaleString(LOCALE[locale] ?? "en-US")
  return `${SIGN[currency] ?? currency.toUpperCase()} ${v}`
}
