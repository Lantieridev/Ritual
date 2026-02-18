import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'
import { LinkButton } from '@/src/core/components/ui'
import { SearchEventsForm } from '@/src/domains/events/components/SearchEventsForm'
import { TicketmasterResults } from '@/src/domains/events/components/TicketmasterResults'
import { SetlistResults } from '@/src/domains/events/components/SetlistResults'
import {
  isTicketmasterConfigured,
  getTicketmasterEventsByArtist,
  getTicketmasterEventsByLocation,
  normalizeTicketmasterEvent,
} from '@/src/core/lib/ticketmaster'
import {
  isSetlistFmConfigured,
  getSetlistsByArtist,
} from '@/src/core/lib/setlistfm'

export const metadata: Metadata = {
  title: 'Buscar recitales | RITUAL',
  description:
    'Buscá shows futuros con Ticketmaster o historial pasado con Setlist.fm. Guardá solo los que quieras en tu agenda.',
}

type SearchParams = { artist?: string; location?: string; source?: 'future' | 'past' }

interface PageProps {
  searchParams: Promise<SearchParams>
}

/**
 * Página de búsqueda multi-fuente:
 * - Ticketmaster: shows futuros y presentes
 * - Setlist.fm: historial de shows pasados con setlists
 */
export default async function BuscarPage({ searchParams }: PageProps) {
  const params = await searchParams
  const source = params.source ?? 'future'
  const hasQuery = Boolean(params.artist?.trim() || params.location?.trim())

  const tmConfigured = isTicketmasterConfigured()
  const slConfigured = isSetlistFmConfigured()

  // Resultados Ticketmaster (shows futuros)
  let tmEvents: ReturnType<typeof normalizeTicketmasterEvent>[] = []
  let tmError: string | undefined

  // Resultados Setlist.fm (shows pasados)
  let slSetlists: Awaited<ReturnType<typeof getSetlistsByArtist>>['setlists'] = []
  let slError: string | undefined

  if (hasQuery && source === 'future' && tmConfigured) {
    if (params.artist?.trim()) {
      const result = await getTicketmasterEventsByArtist(params.artist.trim())
      tmEvents = result.events.map(normalizeTicketmasterEvent)
      tmError = result.error
    } else if (params.location?.trim()) {
      const result = await getTicketmasterEventsByLocation(params.location.trim())
      tmEvents = result.events.map(normalizeTicketmasterEvent)
      tmError = result.error
    }
  }

  if (hasQuery && source === 'past' && slConfigured && params.artist?.trim()) {
    const result = await getSetlistsByArtist(params.artist.trim())
    slSetlists = result.setlists
    slError = result.error
  }

  const anyConfigured = tmConfigured || slConfigured

  return (
    <PageShell
      title="Buscar recitales"
      description="Shows futuros vía Ticketmaster · Historial pasado vía Setlist.fm"
      action={
        <LinkButton href={routes.events.new} variant="secondary" className="px-4 py-2 text-sm">
          + Cargar a mano
        </LinkButton>
      }
    >
      {!anyConfigured && (
        <p className="rounded-lg border border-zinc-500/30 bg-zinc-500/10 text-zinc-300 px-4 py-3 text-sm mb-6">
          Configurá al menos una API key en{' '}
          <code className="bg-white/10 px-1 rounded">.env.local</code> para buscar recitales.
        </p>
      )}

      {/* Tabs: Futuros / Pasados */}
      <div className="flex gap-1 border-b border-white/[0.06] mb-6">
        <a
          href={`/buscar?${new URLSearchParams({ ...(params.artist ? { artist: params.artist } : {}), ...(params.location ? { location: params.location } : {}), source: 'future' }).toString()}`}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${source === 'future'
              ? 'border-white text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
        >
          Shows futuros
          {tmConfigured && (
            <span className="ml-2 text-[10px] uppercase tracking-widest text-zinc-600">
              Ticketmaster
            </span>
          )}
        </a>
        <a
          href={`/buscar?${new URLSearchParams({ ...(params.artist ? { artist: params.artist } : {}), source: 'past' }).toString()}`}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${source === 'past'
              ? 'border-white text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
        >
          Historial pasado
          {slConfigured && (
            <span className="ml-2 text-[10px] uppercase tracking-widest text-zinc-600">
              Setlist.fm
            </span>
          )}
        </a>
      </div>

      {/* Formulario de búsqueda */}
      <Suspense fallback={<div className="h-24 animate-pulse rounded bg-white/5 max-w-md" />}>
        <SearchEventsForm
          configured={anyConfigured}
          initialArtist={params.artist}
          initialLocation={source === 'future' ? params.location : undefined}
          showLocationTab={source === 'future'}
          source={source}
        />
      </Suspense>

      {/* Errores */}
      {(tmError || slError) && (
        <p className="mt-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3" role="alert">
          {tmError || slError}
        </p>
      )}

      {/* Aviso: historial solo por artista */}
      {source === 'past' && !params.artist?.trim() && hasQuery && (
        <p className="mt-4 text-sm text-zinc-500">
          La búsqueda de historial solo funciona por artista.
        </p>
      )}

      {/* Resultados */}
      {hasQuery && !tmError && !slError && (
        <>
          {source === 'future' && tmConfigured && (
            <TicketmasterResults events={tmEvents} />
          )}
          {source === 'past' && slConfigured && params.artist?.trim() && (
            <SetlistResults setlists={slSetlists} />
          )}
        </>
      )}
    </PageShell>
  )
}
