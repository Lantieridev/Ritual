import { redirect } from 'next/navigation'

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

/**
 * /search se fusionó con /buscar (pestaña "En tu archivo") como parte del
 * rediseño — esta ruta queda como redirect para no romper links/bookmarks
 * viejos.
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams
  const params = new URLSearchParams({ tab: 'archivo' })
  if (q) params.set('q', q)
  redirect(`/buscar?${params.toString()}`)
}
