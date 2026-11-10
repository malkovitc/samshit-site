import { readFileSync, rmSync } from "fs"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Смена пароля сотрудника без писем. Пароль не в аргументах (видны в ps): файл /tmp/admin-pass
 * внутри контейнера, строки «email» и «пароль»; файл удаляется сразу после чтения.
 * Запуск: yarn medusa exec ./src/scripts/set-admin-password.ts
 */
export default async function setAdminPassword({ container }: ExecArgs) {
  const log = container.resolve(ContainerRegistrationKeys.LOGGER)
  const file = "/tmp/admin-pass"
  const [email, password] = readFileSync(file, "utf8").split("\n").map((s) => s.trim())
  rmSync(file, { force: true })
  if (!email || !password || password.length < 16) throw new Error("need email and a password of 16+ chars")
  const res = await container.resolve(Modules.AUTH).updateProvider("emailpass", { entity_id: email, password })
  if (!res.success) throw new Error(`password not updated: ${res.error}`)
  log.info(`password updated for ${email}`)
}
