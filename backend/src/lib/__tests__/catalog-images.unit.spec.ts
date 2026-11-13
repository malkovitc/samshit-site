import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { checkCatalogImages } from "../catalog-images"

test("publication accepts a stored local photo and rejects missing or foreign photos", async () => {
  const staticDir = await mkdtemp(join(tmpdir(), "samshit-photos-"))
  try {
    await writeFile(join(staticDir, "good.jpg"), "photo")
    expect(await checkCatalogImages([
      "/static/good.jpg", "http://localhost:9000/static/missing.jpg", "https://other.example/photo.jpg",
    ], { staticDir, apiUrl: "http://localhost:9000" })).toEqual([
      { field: "images.1", message: "Фото недоступно. Загрузите его повторно" },
      { field: "images.2", message: "Фото недоступно. Загрузите его повторно" },
    ])
  } finally { await rm(staticDir, { recursive: true, force: true }) }
})
