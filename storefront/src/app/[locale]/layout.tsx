import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import { NextIntlClientProvider, hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { routing, type Locale } from "@/i18n/routing"
import { Link } from "@/i18n/navigation"
import { currentCurrency, getCart } from "@/lib/data"
import { cartView } from "@/lib/cart-view"
import { CartDrawer, FontTweak, Header, SideNav, SizesModal, Subscribe, UiProvider } from "@/components/chrome"
import "../globals.css"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "brand" })
  return {
    title: { default: t("name"), template: `%s · ${t("name")}` },
    robots: process.env.ALLOW_INDEXING === "true" ? undefined : { index: false, follow: false },
  }
}

const FONTS =
  "https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@200;300;400;500&family=Lilex:wght@200;300;400;500&family=Iosevka+Charon+Mono:wght@300;400;500&family=JetBrains+Mono:wght@200;300;400;500&family=Noto+Sans+Georgian:wght@200;300;400;500&display=swap"

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations()
  const [currency, cart] = await Promise.all([currentCurrency(), getCart()])
  const view = cartView(cart, locale as Locale)
  const umamiSrc = process.env.UMAMI_SCRIPT_URL
  const umamiId = process.env.UMAMI_WEBSITE_ID
  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
        {umamiSrc && umamiId && <script defer src={umamiSrc} data-website-id={umamiId} />}
      </head>
      <body>
        <NextIntlClientProvider>
          <UiProvider>
            <Header currency={view?.currency ?? currency} count={view?.count ?? 0} />
            <div className="shell">
              <SideNav currency={view?.currency ?? currency} />
              <main id="app">{children}</main>
            </div>
            <footer className="u">
              <div className="m">{t("brand.copyright")}<br /><span style={{ color: "var(--accent)" }}>{t("notice.placeholder")}</span></div>
              <div>
                <div className="cols">
                  <a className="ln" href="https://www.instagram.com/samshit.sp/" target="_blank" rel="noopener">Instagram</a>
                  <Link className="ln" href="/contact">Telegram</Link>
                  <Link className="ln" href="/delivery">{t("nav.shipping")}</Link>
                  <Link className="ln" href="/delivery">{t("nav.returns")}</Link>
                  <Link className="ln" href="/about">{t("nav.about")}</Link>
                </div>
                <Subscribe />
              </div>
            </footer>
            <CartDrawer cart={view} />
            <SizesModal />
            <FontTweak />
          </UiProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
