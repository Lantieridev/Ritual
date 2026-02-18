import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'
import { LinkButton } from '@/src/core/components/ui'
import { SearchEventsForm } from '@/src/domains/events/components/SearchEventsForm'
import {
  isBandsintownConfigured,
  getBandsintownEventsByArtist,
  getBandsintownEventsByLocation,
} from '@/src/core/lib/bandsintown'
import { BandsintownResults } from '@/src/domains/events/components/BandsintownResults'

export const metadata: Metadata = {
  title: 'Buscar recitales | RITUAL',
  description: 'Buscá recitales por artista o ciudad. Los resultados vienen de Bandsintown; agregá solo los que quieras a tu agenda.',
}

type SearchParams = { artist?: string; location?: string }

interface PageProps {
  searchParams: Promise<SearchParams>
}

/**
 * Búsqueda de recitales vía API Bandsintown. No guarda en DB hasta que el usuario hace "Agregar".
 */
export default async function BuscarPage({ searchParams }: PageProps) {
  const params = await searchParams
  const configured = isBandsintownConfigured()

  let events: Awaited<ReturnType<typeof getBandsintownEventsByArtist>>['events'] = []
  let error: string | undefined

  if (params.artist?.trim()) {
    const result = await getBandsintownEventsByArtist(params.artist.trim())
    events = result.events
    error = result.error
  } else if (params.location?.trim()) {
    const result = await getBandsintownEventsByLocation(params.location.trim())
    events = result.events
    error = result.error
  }

  return (
    <PageShell
      backHref={routes.home}
      backLabel="← Inicio"
      title="Buscar recitales"
      description="Por artista o por ciudad. Los resultados vienen de internet; agregá solo los que quieras a tu agenda."
      action={
        <LinkButton href={routes.events.new} variant="secondary" className="px-4 py-2 text-sm">
          + Cargar recital a mano
        </LinkButton>
      }
    >
      {!configured && (
        <p className="rounded-lg border border-zinc-500/30 bg-zinc-500/10 text-zinc-300 px-4 py-3 text-sm mb-6">
          Para buscar, configurá <code className="bg-white/10 px-1 rounded">BANDSINTOWN_APP_ID</code> en
          .env.local. Conseguí un app_id gratuito en Bandsintown.
        </p>
      )}

      <Suspense fallback={<div className="h-24 animate-pulse rounded bg-white/5 max-w-md" />}>
        <SearchEventsForm configured={configured} initialArtist={params.artist} initialLocation={params.location} />
      </Suspense>

      {error && (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {configured && (params.artist?.trim() || params.location?.trim()) && !error && (
        <BandsintownResults events={events} searchArtist={params.artist?.trim()} />
      )}
    </PageShell>
  )
}
