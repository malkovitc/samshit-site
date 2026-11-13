import { Button, Container, Heading, Input, Label, Tabs, Text, Textarea, toast } from "@medusajs/ui"
import { useState, type Dispatch, type SetStateAction } from "react"
import type { CatalogError, CatalogInput, Currency, Locale, Size } from "../../../lib/catalog"
import { uploadCatalogImages } from "./api"

const CATEGORIES = [
  ["jackets", "Куртки"], ["trousers", "Брюки"], ["sweatshirts", "Свитшоты и худи"], ["long-sleeves", "Лонгсливы"],
] as const
const LOCALES: [Locale, string][] = [["ru", "Русский"], ["en", "English"], ["ka", "ქართული"]]
const CURRENCIES: Currency[] = ["usd", "eur", "gel"]
const SIZES: Size[] = ["S", "M", "L", "XL"]

type Props = {
  value: CatalogInput
  status: string
  existing: boolean
  busy: boolean
  errors: CatalogError[]
  onChange: Dispatch<SetStateAction<CatalogInput>>
  onSave(publish: boolean): void
  onBack(): void
}

function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-y-1">
    <Label htmlFor={id}>{label}</Label>
    {children}
    {error && <Text size="small" className="text-ui-fg-error">{error}</Text>}
  </div>
}

export function ProductForm({ value, status, existing, busy, errors, onChange, onSave, onBack }: Props) {
  const [uploading, setUploading] = useState(false)
  const err = (field: string) => errors.find((error) => error.field === field)?.message
  const set = <K extends keyof CatalogInput>(key: K, fieldValue: CatalogInput[K]) => onChange((current) => ({ ...current, [key]: fieldValue }))
  const setText = (locale: Locale, field: "title" | "construction" | "material", text: string) => {
    onChange((current) => ({ ...current, i18n: { ...current.i18n, [locale]: { ...current.i18n[locale], [field]: text } } }))
  }
  const setPrice = (currency: Currency, amount: number, mtm = false) => {
    onChange((current) => mtm
      ? { ...current, mtm_prices: current.mtm_prices ? { ...current.mtm_prices, [currency]: amount } : null }
      : { ...current, prices: { ...current.prices, [currency]: amount } })
  }
  const moveImage = (index: number, target: number) => {
    onChange((current) => {
      if (target < 0 || target >= current.images.length) return current
      const images = [...current.images]
      ;[images[index], images[target]] = [images[target], images[index]]
      return { ...current, images }
    })
  }
  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const urls = await uploadCatalogImages(files)
      onChange((current) => ({ ...current, images: [...current.images, ...urls] }))
      toast.success(`Загружено фото: ${urls.length}`)
    } catch (error) {
      toast.error(`Фото не загружены: ${(error as Error).message}`)
    } finally {
      setUploading(false)
    }
  }

  return <div className="flex flex-col gap-y-3">
    <Container className="p-6 flex items-center justify-between gap-x-3">
      <div><Heading level="h1">{existing ? "Редактировать товар" : "Новый товар"}</Heading><Text className="text-ui-fg-subtle">{status === "published" ? "Опубликован" : "Черновик"}</Text></div>
      <Button variant="secondary" onClick={onBack}>К списку</Button>
    </Container>

    {errors.length > 0 && <Container className="p-6">
      <Text weight="plus" className="text-ui-fg-error">Исправьте поля перед сохранением или публикацией:</Text>
      <ul className="list-disc pl-5 mt-2 text-ui-fg-error">{errors.map((error, i) => <li key={`${error.field}-${i}`}>{error.message}</li>)}</ul>
    </Container>}

    <Container className="p-6 flex flex-col gap-y-4">
      <Heading level="h2">Основное</Heading>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field id="catalog-handle" label="Адрес товара" error={err("handle")}><Input id="catalog-handle" value={value.handle} onChange={(e) => set("handle", e.target.value)} placeholder="shield-indigo" /></Field>
        <Field id="catalog-sku" label="Артикул" error={err("sku")}><Input id="catalog-sku" value={value.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} placeholder="SAM-JK02-DNM" /></Field>
        <Field id="catalog-category" label="Категория" error={err("category")}>
          <select id="catalog-category" className="h-8 rounded-md border border-ui-border-base bg-ui-bg-field px-2" value={value.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">Выберите категорию</option>{CATEGORIES.map(([handle, title]) => <option key={handle} value={handle}>{title}</option>)}
          </select>
        </Field>
      </div>
      <Text className="text-ui-fg-subtle">Для черновика достаточно адреса, артикула, категории и названия на русском. Кнопка «Обновить товар» сохраняет изменения на витрине.</Text>
    </Container>

    <Container className="p-6 flex flex-col gap-y-4">
      <Heading level="h2">Название и описание</Heading>
      <Tabs defaultValue="ru">
        <Tabs.List>{LOCALES.map(([locale, label]) => <Tabs.Trigger key={locale} value={locale}>{label}</Tabs.Trigger>)}</Tabs.List>
        {LOCALES.map(([locale]) => <Tabs.Content key={locale} value={locale} className="flex flex-col gap-y-4 pt-4">
          <Field id={`title-${locale}`} label={`Название (${locale})`} error={err(`i18n.${locale}.title`)}><Input id={`title-${locale}`} value={value.i18n[locale].title} onChange={(e) => setText(locale, "title", e.target.value)} /></Field>
          <Field id={`construction-${locale}`} label={`Конструкция и особенности (${locale})`} error={err(`i18n.${locale}.construction`)}><Textarea id={`construction-${locale}`} rows={4} value={value.i18n[locale].construction} onChange={(e) => setText(locale, "construction", e.target.value)} /></Field>
          <Field id={`material-${locale}`} label={`Материал и уход (${locale})`} error={err(`i18n.${locale}.material`)}><Textarea id={`material-${locale}`} rows={3} value={value.i18n[locale].material} onChange={(e) => setText(locale, "material", e.target.value)} /></Field>
        </Tabs.Content>)}
      </Tabs>
    </Container>

    <Container className="p-6 flex flex-col gap-y-4">
      <Heading level="h2">Фото</Heading>
      <Field id="catalog-images" label="Загрузить фото" error={err("images")}>
        <Input id="catalog-images" type="file" accept="image/*" multiple disabled={uploading} onChange={(e) => { void upload(e.target.files); e.target.value = "" }} />
      </Field>
      {uploading && <Text>Загрузка фото…</Text>}
      <div className="flex flex-wrap gap-3">{value.images.map((url, index) => <div key={`${url}-${index}`} className="w-32">
        <img src={url} alt={`Фото ${index + 1}`} className="w-32 h-32 object-cover rounded-md border border-ui-border-base" />
        <Text size="small">{index === 0 ? "Обложка" : `Фото ${index + 1}`}</Text>
        <div className="flex gap-1 mt-1">
          <Button size="small" variant="secondary" disabled={index === 0} onClick={() => moveImage(index, index - 1)}>←</Button>
          <Button size="small" variant="secondary" disabled={index === value.images.length - 1} onClick={() => moveImage(index, index + 1)}>→</Button>
          <Button size="small" variant="danger" onClick={() => onChange((current) => ({ ...current, images: current.images.filter((_, i) => i !== index) }))}>×</Button>
        </div>
      </div>)}</div>
      <Text className="text-ui-fg-subtle">Первое фото будет обложкой. Стрелки меняют порядок.</Text>
    </Container>

    <Container className="p-6 flex flex-col gap-y-4">
      <Heading level="h2">Цены</Heading>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{CURRENCIES.map((currency) => <Field key={currency} id={`price-${currency}`} label={`Цена ${currency.toUpperCase()}`} error={err(`prices.${currency}`)}>
        <Input id={`price-${currency}`} type="number" min="0" step="1" value={value.prices[currency]} onChange={(e) => setPrice(currency, Number(e.target.value))} />
      </Field>)}</div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!!value.mtm_prices} disabled={existing} onChange={(e) => onChange((current) => ({ ...current, mtm_prices: e.target.checked ? { ...current.prices } : null }))} />Пошив по индивидуальным меркам (MTM)</label>
      {existing && <Text className="text-ui-fg-subtle">Наличие MTM после создания товара не меняется; его цены можно редактировать.</Text>}
      {value.mtm_prices && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{CURRENCIES.map((currency) => <Field key={currency} id={`mtm-${currency}`} label={`MTM ${currency.toUpperCase()}`} error={err(`mtm_prices.${currency}`)}>
        <Input id={`mtm-${currency}`} type="number" min="0" step="1" value={value.mtm_prices![currency]} onChange={(e) => setPrice(currency, Number(e.target.value), true)} />
      </Field>)}</div>}
    </Container>

    <Container className="p-6 flex flex-col gap-y-4">
      <Heading level="h2">Размеры и остатки</Heading>
      <Text className="text-ui-fg-subtle">Количество готовых вещей на складе в Тбилиси. Ноль означает пошив под заказ.</Text>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{SIZES.map((size) => <Field key={size} id={`stock-${size}`} label={`Размер ${size}`} error={err(`stock.${size}`)}>
        <Input id={`stock-${size}`} type="number" min="0" step="1" value={value.stock[size]} onChange={(e) => onChange((current) => ({ ...current, stock: { ...current.stock, [size]: Number(e.target.value) } }))} />
      </Field>)}</div>
      <Field id="lead-days" label="Срок пошива, дней" error={err("lead_days")}><Input id="lead-days" type="number" min="1" step="1" value={value.lead_days} onChange={(e) => set("lead_days", Number(e.target.value))} /></Field>
    </Container>

    <Container className="p-6 flex flex-col gap-y-4">
      <Heading level="h2">Тираж и предзаказ</Heading>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!!value.edition} onChange={(e) => set("edition", e.target.checked ? { current: 0, total: 1 } : null)} />Ограниченный тираж</label>
      {value.edition && <div className="grid grid-cols-2 gap-4">
        <Field id="edition-current" label="Текущий номер" error={err("edition.current")}><Input id="edition-current" type="number" min="0" step="1" value={value.edition.current} onChange={(e) => onChange((current) => ({ ...current, edition: current.edition ? { ...current.edition, current: Number(e.target.value) } : null }))} /></Field>
        <Field id="edition-total" label="Всего изделий" error={err("edition.total")}><Input id="edition-total" type="number" min="1" step="1" value={value.edition.total} onChange={(e) => onChange((current) => ({ ...current, edition: current.edition ? { ...current.edition, total: Number(e.target.value) } : null }))} /></Field>
      </div>}
      <Field id="preorder-date" label="Дата предзаказа (необязательно)" error={err("preorder_from")}><Input id="preorder-date" type="date" value={value.preorder_from ?? ""} onChange={(e) => set("preorder_from", e.target.value || null)} /></Field>
      <Text className="text-ui-fg-subtle">Дата показывается покупателю; оформить предзаказ можно уже сейчас.</Text>
    </Container>

    <Container className="p-6 flex gap-3 justify-end">
      <Button variant="secondary" disabled={busy || uploading} onClick={() => onSave(false)}>{status === "published" ? "Снять с публикации и сохранить черновик" : "Сохранить черновик"}</Button>
      <Button disabled={busy || uploading} isLoading={busy} onClick={() => onSave(true)}>{status === "published" ? "Обновить товар" : "Опубликовать"}</Button>
    </Container>
  </div>
}
