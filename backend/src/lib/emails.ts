/**
 * Письма Самшита: тонкая моноширинная вёрстка как на витрине, три языка.
 * Тексты писем — черновик; грузинский перевод нужно вычитать носителю.
 */
export type Locale = "ru" | "en" | "ka"
export const asLocale = (l?: string | null): Locale => (l === "ru" || l === "ka" ? l : "en")

const STORE = () => process.env.STORE_URL || "https://samshit.linza-ai.xyz"

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)

/** Абзацы из простого текста: пустая строка разделяет абзацы. */
export const paragraphs = (text: string) =>
  text.trim().split(/\n\s*\n/).map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("")

/**
 * Каркас письма в айдентике сайта: белое поле, моноширинный тонкий шрифт, шапка между двумя
 * линейками с синей веточкой самшита (PNG: SVG почтовые клиенты не показывают), пунктир перед подвалом.
 * Таблицы и инлайн-стили — для Outlook и Gmail; Source Code Pro подхватят Apple Mail и iOS, остальные — Menlo/Consolas.
 */
function layout(locale: Locale, title: string, body: string, footer: string) {
  const brand = locale === "ka" ? "სამშითი" : locale === "ru" ? "САМШИТ" : "SAMSHIT"
  const font = "'Source Code Pro',Menlo,Consolas,'Courier New',monospace"
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@300;500&display=swap" rel="stylesheet">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:36px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:${font};font-size:13px;line-height:1.7;color:#141416;font-weight:300">
<tr><td style="border-top:1px solid #141416;border-bottom:1px solid #141416;padding:5px 0">
<a href="${STORE()}/${locale}" style="color:#141416;text-decoration:none;font-size:12px;letter-spacing:.12em;font-weight:500">
<img src="${STORE()}/email/sprig.png" width="13" height="13" alt="" style="vertical-align:-2px;border:0;margin-right:6px">${brand}</a></td></tr>
<tr><td style="padding:34px 0 0"><h1 style="margin:0 0 20px;font-family:${font};font-size:14px;font-weight:500;letter-spacing:.07em;text-transform:uppercase;color:#141416">${esc(title)}</h1>
${body}</td></tr>
<tr><td style="padding:34px 0 0"><div style="border-top:1px dotted #141416;padding-top:12px;font-size:11px;line-height:1.7;color:#7a7a84;letter-spacing:.04em">${footer}</div></td></tr>
</table></td></tr></table></body></html>`
}

const T = {
  welcome: {
    subject: { ru: "Добро пожаловать в Самшит", en: "Welcome to Samshit", ka: "მოგესალმებით სამშითში" },
    title: { ru: "Вы с нами", en: "You are in", ka: "თქვენ ჩვენთან ხართ" },
    body: {
      ru: "Здравствуйте{name}.\n\nСпасибо за регистрацию. В кабинете видны ваши заказы, избранное и статус пошива вещей, которые шьются под вас.\n\nКаждую вещь я конструирую и шью сам, в мастерской в Тбилиси. Если хотите что-то по своим меркам или есть вопрос по посадке, просто ответьте на это письмо.",
      en: "Hello{name}.\n\nThank you for signing up. Your account shows your orders, wishlist and the progress of pieces being made for you.\n\nI design and sew every piece myself, in my workshop in Tbilisi. If you would like something made to your measurements or have a question about fit, just reply to this email.",
      ka: "გამარჯობა{name}.\n\nგმადლობთ რეგისტრაციისთვის. კაბინეტში ჩანს თქვენი შეკვეთები, რჩეულები და თქვენთვის შესაკერი ნივთების სტატუსი.\n\nყველა ნივთს თავად ვქმნი და ვკერავ თბილისის სახელოსნოში. თუ გსურთ რამე თქვენი გაზომვებით ან გაქვთ კითხვა მორგებაზე, უბრალოდ უპასუხეთ ამ წერილს.",
    },
    cta: { ru: "Открыть кабинет", en: "Open your account", ka: "კაბინეტის გახსნა" },
  },
  order: {
    subject: { ru: "Заказ #{n} принят", en: "Order #{n} received", ka: "შეკვეთა #{n} მიღებულია" },
    body: {
      ru: "Спасибо за заказ. Я напишу вам, когда вещь будет готова к отправке. Вещи, которые шьются под вас, занимают от 7 до 14 дней.",
      en: "Thank you for your order. I will write to you when it is ready to ship. Pieces made for you take 7 to 14 days.",
      ka: "გმადლობთ შეკვეთისთვის. მოგწერთ, როცა ნივთი გასაგზავნად მზად იქნება. თქვენთვის შესაკერი ნივთები 7-დან 14 დღემდე მზადდება.",
    },
    total: { ru: "Итого", en: "Total", ka: "სულ" },
    mode: {
      stock: { ru: "готовая", en: "ready", ka: "მზა" },
      mto: { ru: "в размере", en: "in size", ka: "ზომით" },
      mtm: { ru: "по меркам", en: "to measurements", ka: "გაზომვებით" },
      pre: { ru: "предзаказ", en: "pre-order", ka: "წინასწარი" },
    },
  },
  subscribed: {
    subject: { ru: "Вы подписаны на новости Самшита", en: "You are subscribed to Samshit news", ka: "თქვენ გამოიწერეთ სამშითის სიახლეები" },
    body: {
      ru: "Буду присылать новые вещи, капсулы и истории из мастерской. Не чаще пары писем в месяц.",
      en: "I will send new pieces, capsules and stories from the workshop. No more than a couple of emails a month.",
      ka: "გამოგიგზავნით ახალ ნივთებს, კაფსულებს და ისტორიებს სახელოსნოდან. თვეში არაუმეტეს ორი წერილისა.",
    },
  },
  footer: {
    ru: "Самшит · мастерская одного человека, Тбилиси",
    en: "Samshit · a one-person workshop, Tbilisi",
    ka: "სამშითი · ერთი ადამიანის სახელოსნო, თბილისი",
  },
  unsubscribe: { ru: "Отписаться от рассылки", en: "Unsubscribe", ka: "გამოწერის გაუქმება" },
}

const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 0"><tr><td style="border:1px solid #141416"><a href="${href}" style="display:inline-block;padding:9px 18px;color:#141416;text-decoration:none;letter-spacing:.1em;text-transform:uppercase;font-size:11px;font-weight:500">${esc(label)} &rarr;</a></td></tr></table>`

const plain = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim()

export function welcomeEmail(locale: Locale, name?: string | null) {
  const t = T.welcome
  const text = t.body[locale].replace("{name}", name ? `, ${name}` : "")
  const html = layout(locale, t.title[locale], paragraphs(text) + button(`${STORE()}/${locale}/account`, t.cta[locale]), esc(T.footer[locale]))
  return { subject: t.subject[locale], html, text: `${text}\n\n${STORE()}/${locale}/account` }
}

export function subscribedEmail(locale: Locale, unsubscribeUrl: string) {
  const t = T.subscribed
  const footer = `${esc(T.footer[locale])}<br><a href="${unsubscribeUrl}" style="color:#7a7a84">${esc(T.unsubscribe[locale])}</a>`
  const html = layout(locale, t.subject[locale], paragraphs(t.body[locale]), footer)
  return { subject: t.subject[locale], html, text: `${t.body[locale]}\n\n${T.unsubscribe[locale]}: ${unsubscribeUrl}` }
}

export function newsletterEmail(locale: Locale, subject: string, bodyText: string, unsubscribeUrl: string) {
  const footer = `${esc(T.footer[locale])}<br><a href="${unsubscribeUrl}" style="color:#7a7a84">${esc(T.unsubscribe[locale])}</a>`
  const html = layout(locale, subject, paragraphs(bodyText) + button(`${STORE()}/${locale}/shop`, locale === "ru" ? "В магазин" : locale === "ka" ? "მაღაზიაში" : "Shop"), footer)
  return { subject, html, text: `${bodyText}\n\n${STORE()}/${locale}/shop\n\n${T.unsubscribe[locale]}: ${unsubscribeUrl}` }
}

type OrderLike = {
  display_id?: number | null
  currency_code: string
  total?: number | null
  items?: { title?: string | null; product_title?: string | null; variant_title?: string | null; quantity: number; total?: number | null; metadata?: Record<string, unknown> | null; product?: { metadata?: Record<string, unknown> | null } | null }[] | null
}

const SIGN: Record<string, string> = { usd: "$", gel: "₾", eur: "€" }
const fmt = (n: number, c: string) => `${SIGN[c] ?? c.toUpperCase()} ${Math.round(n).toLocaleString("en-US").replace(/,/g, " ")}`

export function orderEmail(locale: Locale, order: OrderLike) {
  const t = T.order
  const n = String(order.display_id ?? "")
  const rows = (order.items ?? []).map((i) => {
    const i18n = (i.product?.metadata as { i18n?: Record<string, { title?: string }> } | undefined)?.i18n
    const title = i18n?.[locale]?.title ?? i.product_title ?? i.title ?? ""
    const mode = ((i.metadata as { mode?: keyof typeof t.mode } | null)?.mode ?? "stock") as keyof typeof t.mode
    const size = i.variant_title === "MTM" ? "" : `${i.variant_title} · `
    return { title, desc: `${size}${t.mode[mode]?.[locale] ?? ""}${i.quantity > 1 ? ` · ×${i.quantity}` : ""}`, sum: fmt(i.total ?? 0, order.currency_code) }
  })
  const table = `<table style="width:100%;border-collapse:collapse;font-size:12px;margin:18px 0 0">${rows
    .map((r) => `<tr><td style="padding:8px 0;border-bottom:1px solid #dedee4">${esc(r.title)}<br><span style="color:#7a7a84">${esc(r.desc)}</span></td><td style="padding:8px 0;border-bottom:1px solid #dedee4;text-align:right;white-space:nowrap">${r.sum}</td></tr>`)
    .join("")}<tr><td style="padding:10px 0;text-transform:uppercase;letter-spacing:.06em">${t.total[locale]}</td><td style="padding:10px 0;text-align:right">${fmt(order.total ?? 0, order.currency_code)}</td></tr></table>`
  const subject = t.subject[locale].replace("{n}", n)
  const html = layout(locale, subject, paragraphs(t.body[locale]) + table + button(`${STORE()}/${locale}/account`, T.welcome.cta[locale]), esc(T.footer[locale]))
  const text = `${t.body[locale]}\n\n${rows.map((r) => `${r.title} — ${r.desc} — ${r.sum}`).join("\n")}\n${t.total[locale]}: ${fmt(order.total ?? 0, order.currency_code)}`
  return { subject, html, text: plain(text) }
}
