import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CubeSolid } from "@medusajs/icons"
import { Button, Container, Heading, Table, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import type { CatalogInput, CatalogError } from "../../../lib/catalog"
import { CatalogApiError, getCatalog, listCatalog, publishCatalog, saveCatalog, type CatalogSummary } from "../../components/samshit-products/api"
import { ProductForm } from "../../components/samshit-products/form"

const emptyForm = (): CatalogInput => ({
  handle: "", sku: "", category: "", images: [],
  i18n: {
    ru: { title: "", construction: "", material: "" },
    en: { title: "", construction: "", material: "" },
    ka: { title: "", construction: "", material: "" },
  },
  prices: { usd: 0, eur: 0, gel: 0 }, mtm_prices: null,
  stock: { S: 0, M: 0, L: 0, XL: 0 }, lead_days: 0,
  edition: null, preorder_from: null,
})

const OwnerProductsPage = () => {
  const [products, setProducts] = useState<CatalogSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [id, setId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState("draft")
  const [value, setValue] = useState<CatalogInput>(emptyForm)
  const [errors, setErrors] = useState<CatalogError[]>([])

  const refresh = async () => {
    try { setProducts(await listCatalog()) }
    catch (error) { toast.error(`Товары не загружены: ${(error as Error).message}`) }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])

  const open = async (productId: string, duplicate = false) => {
    setBusy(true)
    try {
      const record = await getCatalog(productId)
      setValue(duplicate ? { ...record.input, handle: "", sku: "", stock: { S: 0, M: 0, L: 0, XL: 0 } } : record.input)
      setId(duplicate ? null : productId)
      setStatus(duplicate ? "draft" : record.status)
      setErrors([])
      setEditing(true)
    } catch (error) { toast.error(`Товар не открыт: ${(error as Error).message}`) }
    finally { setBusy(false) }
  }

  const save = async (publish: boolean) => {
    setBusy(true)
    setErrors([])
    try {
      if (publish && id && status === "published") {
        await publishCatalog(id, value)
        await refresh()
        toast.success("Товар обновлён")
        return
      }
      const savedId = await saveCatalog(value, id ?? undefined)
      setId(savedId)
      setStatus("draft")
      if (publish) {
        await publishCatalog(savedId)
        setStatus("published")
      }
      await refresh()
      toast.success(publish ? "Товар опубликован" : "Черновик сохранён")
    } catch (error) {
      if (error instanceof CatalogApiError) {
        setErrors(error.errors)
        if (error.id) { setId(error.id); setStatus("draft"); await refresh() }
      }
      toast.error((error as Error).message)
    } finally { setBusy(false) }
  }

  if (editing) return <ProductForm value={value} status={status} existing={!!id} busy={busy} errors={errors} onChange={setValue} onSave={(publish) => { void save(publish) }} onBack={() => { setEditing(false); setErrors([]); void refresh() }} />

  return <div className="flex flex-col gap-y-3">
    <Container className="p-6 flex items-center justify-between gap-x-3">
      <div><Heading level="h1">Товары Самшит</Heading><Text className="text-ui-fg-subtle mt-1">Добавляйте товары по одному и публикуйте после проверки всех данных.</Text></div>
      <Button onClick={() => { setValue(emptyForm()); setId(null); setStatus("draft"); setErrors([]); setEditing(true) }}>Новый товар</Button>
    </Container>
    <Container className="p-0">
      <Table>
        <Table.Header><Table.Row><Table.HeaderCell>Товар</Table.HeaderCell><Table.HeaderCell>Артикул</Table.HeaderCell><Table.HeaderCell>Статус</Table.HeaderCell><Table.HeaderCell>Действия</Table.HeaderCell></Table.Row></Table.Header>
        <Table.Body>{products.map((product) => <Table.Row key={product.id}>
          <Table.Cell><div className="flex items-center gap-3">{product.thumbnail && <img src={product.thumbnail} alt="" className="h-10 w-10 rounded object-cover" />}<span>{product.title}</span></div></Table.Cell>
          <Table.Cell>{product.sku}</Table.Cell>
          <Table.Cell>{product.status === "published" ? "Опубликован" : "Черновик"}</Table.Cell>
          <Table.Cell><div className="flex gap-2"><Button size="small" variant="secondary" disabled={busy} onClick={() => { void open(product.id) }}>Открыть</Button><Button size="small" variant="secondary" disabled={busy} onClick={() => { void open(product.id, true) }}>Дублировать</Button></div></Table.Cell>
        </Table.Row>)}</Table.Body>
      </Table>
      {!loading && products.length === 0 && <div className="p-6"><Text>Товаров пока нет.</Text></div>}
    </Container>
  </div>
}

export const config = defineRouteConfig({ label: "Товары Самшит", icon: CubeSolid })
export default OwnerProductsPage
