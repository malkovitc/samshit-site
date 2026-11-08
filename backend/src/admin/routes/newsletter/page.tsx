import { defineRouteConfig } from "@medusajs/admin-sdk"
import { EnvelopeSolid } from "@medusajs/icons"
import { Button, Container, Heading, Input, Label, Table, Tabs, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

type Locale = "ru" | "en" | "ka"
type Data = {
  counts: { subscribed: number; unsubscribed: number; by_locale: Record<string, number> }
  subscribers: { email: string; locale: string; status: string; source: string; created_at: string }[]
}
const LOCALES: [Locale, string][] = [["ru", "Русский"], ["en", "English"], ["ka", "ქართული"]]
const empty = { ru: { subject: "", body: "" }, en: { subject: "", body: "" }, ka: { subject: "", body: "" } }

// Рассылка: подписчики и отправка письма на языке каждого подписчика.
const NewsletterPage = () => {
  const [data, setData] = useState<Data | null>(null)
  const [content, setContent] = useState(empty)
  const [testEmail, setTestEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const load = () => fetch("/admin/newsletter", { credentials: "include" }).then((r) => r.json()).then(setData)
  useEffect(() => { load() }, [])

  const send = async (test: boolean) => {
    setBusy(true)
    try {
      const r = await fetch("/admin/newsletter/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(test ? { content, test_email: testEmail } : { content }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.message)
      toast.success(test ? `Тестовых писем отправлено: ${j.sent}` : `Отправлено ${j.sent} из ${j.total}`)
      setConfirm(false)
    } catch (e) {
      toast.error(`Не отправлено: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const set = (l: Locale, k: "subject" | "body", v: string) => setContent({ ...content, [l]: { ...content[l], [k]: v } })
  const ready = LOCALES.some(([l]) => content[l].subject.trim() && content[l].body.trim())

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="p-6">
        <Heading level="h1">Рассылка</Heading>
        <Text className="text-ui-fg-subtle mt-1">
          Подписаны: {data?.counts.subscribed ?? "…"} · отписались: {data?.counts.unsubscribed ?? "…"}
          {data && Object.entries(data.counts.by_locale).map(([l, n]) => ` · ${l.toUpperCase()} ${n}`)}
        </Text>
      </Container>

      <Container className="p-6 flex flex-col gap-y-4">
        <Heading level="h2">Новое письмо</Heading>
        <Text className="text-ui-fg-subtle">
          Каждый подписчик получит письмо на своём языке. Если текста на его языке нет — английский. Пустая строка разделяет абзацы.
        </Text>
        <Tabs defaultValue="ru">
          <Tabs.List>{LOCALES.map(([l, n]) => <Tabs.Trigger key={l} value={l}>{n}</Tabs.Trigger>)}</Tabs.List>
          {LOCALES.map(([l]) => (
            <Tabs.Content key={l} value={l} className="flex flex-col gap-y-3 pt-4">
              <div><Label htmlFor={`s-${l}`}>Тема</Label><Input id={`s-${l}`} value={content[l].subject} onChange={(e) => set(l, "subject", e.target.value)} /></div>
              <div><Label htmlFor={`b-${l}`}>Текст</Label><Textarea id={`b-${l}`} rows={10} value={content[l].body} onChange={(e) => set(l, "body", e.target.value)} /></div>
            </Tabs.Content>
          ))}
        </Tabs>
        <div className="flex gap-x-2 items-end">
          <div className="flex-1"><Label htmlFor="test">Тест себе</Label><Input id="test" type="email" placeholder="you@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} /></div>
          <Button variant="secondary" disabled={!ready || !testEmail || busy} onClick={() => send(true)}>Отправить тест</Button>
        </div>
        {!confirm ? (
          <Button disabled={!ready || busy || !data?.counts.subscribed} onClick={() => setConfirm(true)}>Отправить всем подписчикам</Button>
        ) : (
          <div className="flex gap-x-2 items-center">
            <Text>Отправить {data?.counts.subscribed} подписчикам? Отменить будет нельзя.</Text>
            <Button variant="danger" isLoading={busy} onClick={() => send(false)}>Да, отправить</Button>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Отмена</Button>
          </div>
        )}
      </Container>

      <Container className="p-0">
        <Table>
          <Table.Header><Table.Row><Table.HeaderCell>Email</Table.HeaderCell><Table.HeaderCell>Язык</Table.HeaderCell><Table.HeaderCell>Статус</Table.HeaderCell><Table.HeaderCell>Откуда</Table.HeaderCell><Table.HeaderCell>Дата</Table.HeaderCell></Table.Row></Table.Header>
          <Table.Body>
            {data?.subscribers.map((s) => (
              <Table.Row key={s.email}>
                <Table.Cell>{s.email}</Table.Cell><Table.Cell>{s.locale}</Table.Cell><Table.Cell>{s.status}</Table.Cell><Table.Cell>{s.source}</Table.Cell>
                <Table.Cell>{new Date(s.created_at).toLocaleDateString("ru-RU")}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({ label: "Рассылка", icon: EnvelopeSolid })

export default NewsletterPage
