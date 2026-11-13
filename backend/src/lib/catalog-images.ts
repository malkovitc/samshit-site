import { stat } from "node:fs/promises"
import { join } from "node:path"
import type { CatalogError } from "./catalog"

export async function checkCatalogImages(
  urls: string[],
  options: { staticDir: string; apiUrl: string; s3Url?: string },
): Promise<CatalogError[]> {
  const errors: CatalogError[] = []
  const apiOrigin = new URL(options.apiUrl).origin
  for (const [index, value] of urls.entries()) {
    let url: URL
    try { url = new URL(value, apiOrigin) }
    catch { errors.push({ field: `images.${index}`, message: "Некорректный адрес фото" }); continue }
    try {
      if (url.origin === apiOrigin && url.pathname.startsWith("/static/")) {
        const name = decodeURIComponent(url.pathname.slice("/static/".length))
        if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\")) throw new Error("invalid path")
        if (!(await stat(join(options.staticDir, name))).isFile()) throw new Error("missing file")
      } else if (options.s3Url && value.startsWith(options.s3Url.replace(/\/$/, "") + "/")) {
        const response = await fetch(value, { method: "HEAD", signal: AbortSignal.timeout(5000) })
        if (!response.ok) throw new Error("missing object")
      } else {
        throw new Error("unrecognized source")
      }
    } catch {
      errors.push({ field: `images.${index}`, message: "Фото недоступно. Загрузите его повторно" })
    }
  }
  return errors
}
