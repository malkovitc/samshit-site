export async function collectPages<T>(fetchPage: (offset: number, limit: number) => Promise<T[]>, limit = 100): Promise<T[]> {
  const all: T[] = []
  for (let offset = 0; ; offset += limit) {
    const page = await fetchPage(offset, limit)
    all.push(...page)
    if (page.length < limit) return all
  }
}

export function visibleProduct(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.catalog_managed !== true || metadata.catalog_ready === true
}

export function newestProducts<T extends { createdAt: string }>(products: T[], limit = 4): T[] {
  return [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
}
