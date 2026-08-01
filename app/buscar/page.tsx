import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'
import { LinkButton } from '@/src/core/components/ui'
import { SearchEventsForm } from '@/src/domains/events/components/SearchEventsForm'
import { SetlistResults } from '@/src/domains/events/components/SetlistResults'
import { FutureEventsResults } from '@/src/domains/events/components/FutureEventsResults'
import { isTicketmasterConfigured, searchTicketmasterEvents } from '@/src/core/lib/ticketmaster'
import { isSetlistFmConfigured, getSetlistsByArtist } from '@/src/core/lib/setlistfm'
import { createClient } from '@/src/core/lib/supabase/server'
import { formatDate } from '@/src/core/lib/utils'
import { EmptyState } from '@/src/core/components/ui/EmptyState'

export const metadata: Metadata = {
  title: 'Buscar | RITUAL',
  description: 'En cartelera vía Ticketmaster/Setlist.fm, o en tu archivo ya guardado.',
}

type SearchParams = { artist?: string; location?: string; source?: 'future' | 'past'; tab?: 'cartelera' | 'archivo'; q?: string }

interface PageProps {
  searchParams: Promise<SearchParams>
}

async function globalSearch(query: string) {
  const q = `%${query}%`
  const supabase = await createClient()
  const [eventsRes, artistsRes, venuesRes] = await Promise.all([
    supabase.from('events').select('id, name, date').ilike('name', q).order('date', { ascending: false }).limit(8),
    supabase.from('artists').select('id, name, genre').ilike('name', q).limit(8),
    supabase.from('venues').select('id, name, city, country').ilike('name', q).limit(8),
  ])
  return {
    events: eventsRes.data ?? [],
    artists: artistsRes.data ?? [],
    venues: venuesRes.data ?? [],
  }
}

function tabHref(tab: 'cartelera' | 'archivo', params: SearchParams) {
  const usp = new URLSearchParams()
  if (tab === 'cartelera') {
    if (params.artist) usp.set('artist', params.artist)
    if (params.location) usp.set('location', params.location)
    usp.set('source', params.source ?? 'future')
  } else if (params.q) {
    usp.set('q', params.q)
  }
  usp.set('tab', tab)
  return `/buscar?${usp.toString()}`
}

export default async function BuscarPage({ searchParams }: PageProps) {
  const params = await searchParams
  const tab = params.tab ?? 'cartelera'
  const source = params.source ?? 'future'
  const hasQuery = Boolean(params.artist?.trim() || params.location?.trim())

  const tmConfigured = isTicketmasterConfigured()
  const slConfigured = isSetlistFmConfigured()
  const anyConfigured = tmConfigured || slConfigured

  let tmEvents: Awaited<ReturnType<typeof searchTicketmasterEvents>>['events'] = []
  let tmError: string | undefined
  let slSetlists: Awaited<ReturnType<typeof getSetlistsByArtist>>['setlists'] = []
  let slError: string | undefined

  if (tab === 'cartelera') {
    if (hasQuery && source === 'future' && tmConfigured) {
      const result = await searchTicketmasterEvents({ keyword: params.artist, city: params.location })
      tmEvents = result.events
      tmError = result.error
    }
    if (hasQuery && source === 'past' && slConfigured && params.artist?.trim()) {
      const result = await getSetlistsByArtist(params.artist.trim())
      slSetlists = result.setlists
      slError = result.error
    }
  }

  const query = params.q?.trim() ?? ''
  const archiveResults = tab === 'archivo' && query.length >= 2 ? await globalSearch(query) : null
  const archiveTotal = archiveResults
    ? archiveResults.events.length + archiveResults.artists.length + archiveResults.venues.length
    : 0

  return (
    <PageShell
      title="Buscar"
      action={
        <LinkButton href={routes.events.new} variant="secondary" className="px-4 py-2">
          + Cargar a mano
        </LinkButton>
      }
    >
      {/* Tabs principales */}
      <div className="flex border-b border-ritual-border-subtle mb-8">
        <Link
          href={tabHref('cartelera', params)}
          className={`px-5 py-3 font-label text-[10px] tracking-[0.16em] uppercase border-b-2 -mb-px transition-colors ${tab === 'cartelera' ? 'border-ritual-red text-ritual-bone' : 'border-transparent text-ritual-gray-text hover:text-ritual-gray-text'
            }`}
        >
          En cartelera
        </Link>
        <Link
          href={tabHref('archivo', params)}
          className={`px-5 py-3 font-label text-[10px] tracking-[0.16em] uppercase border-b-2 -mb-px transition-colors ${tab === 'archivo' ? 'border-ritual-red text-ritual-bone' : 'border-transparent text-ritual-gray-text hover:text-ritual-gray-text'
            }`}
        >
          En tu archivo
        </Link>
      </div>

      {tab === 'cartelera' ? (
        <>
          {!anyConfigured && (
            <div className="border border-ritual-border bg-ritual-surface px-5 py-4 mb-6 space-y-2">
              <p className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-text">APIs no configuradas</p>
              <p className="font-body text-sm text-ritual-gray-text">
                Para shows futuros necesitás <strong className="text-ritual-gray-text">TICKETMASTER_API_KEY</strong>, para historial{' '}
                <strong className="text-ritual-gray-text">SETLISTFM_API_KEY</strong> en <code className="bg-ritual-surface-high px-1">.env.local</code>.
              </p>
            </div>
          )}

          <div className="flex gap-1 mb-6">
            <Link
              href={`/buscar?${new URLSearchParams({ ...(params.artist ? { artist: params.artist } : {}), source: 'future', tab: 'cartelera' }).toString()}`}
              className={`px-4 py-2 font-label text-[10px] tracking-[0.1em] uppercase ${source === 'future' ? 'bg-ritual-surface-high text-ritual-bone' : 'text-ritual-gray-text hover:text-ritual-gray-text'}`}
            >
              Shows futuros
            </Link>
            <Link
              href={`/buscar?${new URLSearchParams({ ...(params.artist ? { artist: params.artist } : {}), source: 'past', tab: 'cartelera' }).toString()}`}
              className={`px-4 py-2 font-label text-[10px] tracking-[0.1em] uppercase ${source === 'past' ? 'bg-ritual-surface-high text-ritual-bone' : 'text-ritual-gray-text hover:text-ritual-gray-text'}`}
            >
              Historial pasado
            </Link>
          </div>

          <Suspense fallback={<div className="h-24 animate-pulse bg-ritual-surface max-w-md" />}>
            <SearchEventsForm
              configured={anyConfigured}
              initialArtist={params.artist}
              initialLocation={params.location}
              showLocationTab={source === 'future'}
              source={source}
            />
          </Suspense>

          {(tmError || slError) && (
            <div className="mt-4 border border-ritual-red/30 bg-ritual-red/10 px-4 py-3" role="alert">
              <p className="font-body text-sm text-ritual-red-hover">{tmError || slError}</p>
            </div>
          )}

          {source === 'past' && !params.artist?.trim() && hasQuery && (
            <p className="mt-4 font-body text-sm text-ritual-gray-text">La búsqueda de historial solo funciona por artista.</p>
          )}

          {hasQuery && !tmError && !slError && (
            <>
              {source === 'future' && tmConfigured && <FutureEventsResults events={tmEvents} searchQuery={params.artist || params.location} />}
              {source === 'past' && slConfigured && params.artist?.trim() && <SetlistResults setlists={slSetlists} />}
            </>
          )}

          {!hasQuery && source === 'future' && tmConfigured && (
            <EmptyState title="Buscá tu música" description="Artista o ciudad para shows futuros vía Ticketmaster." className="border-dashed mt-8" />
          )}
          {!hasQuery && source === 'past' && slConfigured && (
            <EmptyState title="Historial de shows" description="Nombre exacto del artista, vía Setlist.fm." className="border-dashed mt-8" />
          )}
        </>
      ) : (
        <>
          <form method="GET" action={routes.search} className="mb-8 max-w-md">
            <input type="hidden" name="tab" value="archivo" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Nombre de artista, evento o venue..."
              autoFocus
              autoComplete="off"
              className="w-full border border-ritual-border bg-ritual-surface px-4 py-3 font-body text-ritual-bone placeholder-ritual-gray-mid focus:border-ritual-red focus:outline-none focus:ring-1 focus:ring-ritual-red/40"
            />
          </form>

          {query.length >= 2 && archiveResults && (
            <div className="space-y-8">
              {archiveTotal === 0 && (
                <p className="font-body text-ritual-gray-text text-center py-8">
                  Sin resultados para <strong className="text-ritual-gray-text">&quot;{query}&quot;</strong>
                </p>
              )}
              {archiveResults.events.length > 0 && (
                <section>
                  <p className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text mb-3">
                    Eventos ({archiveResults.events.length})
                  </p>
                  <ul className="divide-y divide-ritual-border-subtle">
                    {archiveResults.events.map((ev) => (
                      <li key={ev.id}>
                        <Link href={routes.events.detail(ev.id)} className="flex items-center justify-between gap-4 py-3 group">
                          <span className="font-dense font-extrabold text-ritual-bone truncate">{ev.name || 'Recital'}</span>
                          <span className="font-label text-xs text-ritual-gray-text whitespace-nowrap">
                            {formatDate(ev.date, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {archiveResults.artists.length > 0 && (
                <section>
                  <p className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text mb-3">
                    Artistas ({archiveResults.artists.length})
                  </p>
                  <ul className="divide-y divide-ritual-border-subtle">
                    {archiveResults.artists.map((artist) => (
                      <li key={artist.id}>
                        <Link href={routes.artists.detail(artist.id)} className="flex items-center gap-3 py-3">
                          <span className="font-dense font-extrabold text-ritual-bone">{artist.name}</span>
                          {artist.genre && <span className="font-label text-xs text-ritual-gray-text">{artist.genre}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {archiveResults.venues.length > 0 && (
                <section>
                  <p className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text mb-3">
                    Venues ({archiveResults.venues.length})
                  </p>
                  <ul className="divide-y divide-ritual-border-subtle">
                    {archiveResults.venues.map((venue) => (
                      <li key={venue.id}>
                        <Link href={routes.venues.detail(venue.id)} className="flex items-center justify-between gap-4 py-3">
                          <span className="font-dense font-extrabold text-ritual-bone truncate">{venue.name}</span>
                          {venue.city && <span className="font-label text-xs text-ritual-gray-text whitespace-nowrap">{venue.city}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {query.length > 0 && query.length < 2 && (
            <p className="font-body text-sm text-ritual-gray-text text-center py-4">Escribí al menos 2 caracteres.</p>
          )}
          {!query && (
            <p className="font-body text-sm text-ritual-gray-text text-center py-8">Buscá entre lo que ya guardaste.</p>
          )}
        </>
      )}
    </PageShell>
  )
}
