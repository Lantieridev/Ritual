import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'
import { LinkButton } from '@/src/core/components/ui'
import { SearchEventsForm } from '@/src/domains/events/components/SearchEventsForm'
import { SetlistResults } from '@/src/domains/events/components/SetlistResults'
import { FutureEventsResults } from '@/src/domains/events/components/FutureEventsResults'
import { isTicketmasterConfigured, searchTicketmasterEvents } from '@/src/core/lib/ticketmaster'
import {
  isSetlistFmConfigured,
  getSetlistsByArtist,
} from '@/src/core/lib/setlistfm'
import { EmptyState } from '@/src/core/components/ui/EmptyState'

export const metadata: Metadata = {
  title: 'Buscar recitales | RITUAL',
  description:
    'Buscá shows futuros vía Ticketmaster o historial pasado con Setlist.fm. Guardá solo los que quieras en tu agenda.',
}

type SearchParams = { artist?: string; location?: string; source?: 'future' | 'past' }

interface PageProps {
  searchParams: Promise<SearchParams>
}

export default async function BuscarPage({ searchParams }: PageProps) {
  const params = await searchParams
  const source = params.source ?? 'future'
  const hasQuery = Boolean(params.artist?.trim() || params.location?.trim())

  const tmConfigured = isTicketmasterConfigured()
  const slConfigured = isSetlistFmConfigured()

  let tmEvents: Awaited<ReturnType<typeof searchTicketmasterEvents>>['events'] = []
  let tmError: string | undefined

  let slSetlists: Awaited<ReturnType<typeof getSetlistsByArtist>>['setlists'] = []
  let slError: string | undefined

  if (hasQuery && source === 'future' && tmConfigured) {
    const result = await searchTicketmasterEvents({
      keyword: params.artist,
      city: params.location,
    })
    tmEvents = result.events
    tmError = result.error
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
      {/* Aviso cuando ninguna API está configurada */}
      {!anyConfigured && (
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 px-5 py-4 mb-6 space-y-2">
          <p className="text-sm font-semibold text-zinc-300">⚙️ APIs no configuradas</p>
          <p className="text-sm text-zinc-500">
            Para buscar shows futuros necesitás una{' '}
            <strong className="text-zinc-400">TICKETMASTER_API_KEY</strong> en{' '}
            <code className="bg-white/10 px-1 rounded text-xs">.env.local</code>.
            Para historial pasado, una{' '}
            <strong className="text-zinc-400">SETLISTFM_API_KEY</strong>.
          </p>
          <p className="text-xs text-zinc-600">
            También podés cargar recitales a mano con el botón de arriba.
          </p>
        </div>
      )}

      {/* Tabs: Futuros / Pasados */}
      <div className="flex gap-1 border-b border-white/[0.06] mb-6">
        <a
          href={`/buscar?${new URLSearchParams({ ...(params.artist ? { artist: params.artist } : {}), source: 'future' }).toString()}`}
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
          {!tmConfigured && (
            <span className="ml-2 text-[10px] text-zinc-700">no disponible</span>
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
          {!slConfigured && (
            <span className="ml-2 text-[10px] text-zinc-700">no disponible</span>
          )}
        </a>
        <a
          href={routes.search}
          className="px-4 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors border-b-2 border-transparent -mb-px ml-auto"
        >
          Ya guardado →
        </a>
      </div>

      {/* Formulario de búsqueda */}
      <Suspense fallback={<div className="h-24 animate-pulse rounded bg-white/5 max-w-md" />}>
        <SearchEventsForm
          configured={anyConfigured}
          initialArtist={params.artist}
          initialLocation={params.location}
          showLocationTab={source === 'future'}
          source={source}
        />
      </Suspense>

      {/* Errores */}
      {(tmError || slError) && (
        <div className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3" role="alert">
          <p className="text-sm text-red-400">{tmError || slError}</p>
        </div>
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
            <FutureEventsResults events={tmEvents} searchQuery={params.artist || params.location} />
          )}
          {source === 'past' && slConfigured && params.artist?.trim() && (
            <SetlistResults setlists={slSetlists} />
          )}
        </>
      )}

      {/* Empty States */}
      {!hasQuery && source === 'future' && tmConfigured && (
        <EmptyState
          title="Buscá tu música"
          description="Escribí el nombre de un artista o una ciudad para buscar shows futuros vía Ticketmaster."
          icon={<span className="text-4xl grayscale">🔍</span>}
          className="border-dashed mt-8"
        />
      )}

      {!hasQuery && source === 'past' && slConfigured && (
        <EmptyState
          title="Historial de shows"
          description="Escribí el nombre exacto del artista para ver su historial de shows (Setlist.fm)."
          icon={<span className="text-4xl grayscale">📜</span>}
          className="border-dashed mt-8"
        />
      )}
    </PageShell>
  )
}
