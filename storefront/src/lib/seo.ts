import type { Metadata } from "next"
import type { Locale } from "../i18n/routing"

const LOCALES: Locale[] = ["ru", "en", "ka"]

export function siteOrigin(): string {
  return new URL(process.env.SITE_URL || "https://samshit.linza-ai.xyz").origin
}

export function publicUrl(locale: Locale, path = ""): string {
  const clean = path.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, "")
  return `${siteOrigin()}/${locale}${clean ? `/${clean}` : ""}`
}

export function pageAlternates(locale: Locale, path = ""): Metadata["alternates"] {
  return {
    canonical: publicUrl(locale, path),
    languages: {
      ...Object.fromEntries(LOCALES.map((language) => [language, publicUrl(language, path)])),
      "x-default": publicUrl("en", path),
    },
  }
}

export function indexingEnabled(): boolean {
  return process.env.ALLOW_INDEXING === "true"
}

export function publicRobots(): Metadata["robots"] {
  return { index: indexingEnabled(), follow: true }
}

export function privateRobots(): Metadata["robots"] {
  return { index: false, follow: true }
}

export function pageMetadata(locale: Locale, path: string, title?: string, description?: string): Metadata {
  return { title, description, alternates: pageAlternates(locale, path), robots: publicRobots() }
}
