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
import { searchCachedExternalEvents } from '@/src/core/lib/external-sources/cache'
import { isSetlistFmConfigured, getSetlistsByArtist } from '@/src/core/lib/setlistfm'
import { searchCatalog, searchNearby } from '@/src/domains/search/service'
import { festivalMetaLine } from '@/src/domains/search/festivalMeta'
import { toSearchRows, nearbyToSearchRows, filterLabel, parseSearchFilter, type SearchFilter } from '@/src/domains/search/rows'
import { SearchField } from '@/src/domains/search/components/SearchField'
import { SearchFilters } from '@/src/domains/search/components/SearchFilters'
import { SearchRowList } from '@/src/domains/search/components/SearchRowList'
import { NearbyNotice } from '@/src/domains/search/components/NearbyNotice'
import { formatDate } from '@/src/core/lib/utils'
import { EmptyState } from '@/src/core/components/ui/EmptyState'
import { createClient } from '@/src/core/lib/supabase/server'
import { findProfile } from '@/src/domains/auth/service'

export const metadata: Metadata = {
  title: 'Buscar | RITUAL',
  description: 'En cartelera vía Ticketmaster/Setlist.fm, o en tu archivo ya guardado.',
}

type SearchParams = {
  artist?: string
  location?: string
  source?: 'future' | 'past'
  tab?: 'cartelera' | 'archivo'
  q?: string
  filtro?: string
}

interface PageProps {
  searchParams: Promise<SearchParams>
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
  const anyConfigured = true // We always have the local cache now

  let tmEvents: Awaited<ReturnType<typeof searchTicketmasterEvents>>['events'] = []
  let tmError: string | undefined
  let slSetlists: Awaited<ReturnType<typeof getSetlistsByArtist>>['setlists'] = []
  let slError: string | undefined

  if (tab === 'cartelera') {
    if (hasQuery && source === 'future') {
      const [tmResult, cacheResult] = await Promise.all([
        tmConfigured 
          ? searchTicketmasterEvents({ keyword: params.artist, city: params.location })
          : Promise.resolve({ events: [], total: 0, error: undefined }),
        searchCachedExternalEvents({ keyword: params.artist, city: params.location })
      ])
      
      // Combine events
      tmEvents = [...tmResult.events, ...cacheResult.events]
      // Sort by date ascending to interleave TM and Cached events properly
      tmEvents.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())

      tmError = tmResult.error // We prefer to show TM errors if any, cache errors are just logged internally for now
    }
    if (hasQuery && source === 'past' && slConfigured && params.artist?.trim()) {
      const result = await getSetlistsByArtist(params.artist.trim())
      slSetlists = result.setlists
      slError = result.error
    }
  }

  // Prellena el campo de ciudad con la del perfil (issue #55) — sólo el
  // valor por defecto del input, nunca `params.location`: escribirlo ahí
  // dispararía una búsqueda apenas se entra a la página, antes de que el
  // usuario haya tocado nada.
  let profileLocation: string | undefined
  if (tab === 'cartelera' && !params.location?.trim()) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const profile = await findProfile(user.id)
      profileLocation = profile?.location ?? undefined
    }
  }

  const query = params.q?.trim() ?? ''
  const filtro: SearchFilter = parseSearchFilter(params.filtro)

  // Independiente de `tab` Y de `filtro`, a propósito: el chip screen
  // mobile necesita resultados del catálogo sin importar en qué tab
  // desktop esté la URL (un `?q=`+`filtro` sin `tab=archivo` explícito es
  // válido si alguien escribe el link a mano). Y desktop no sabe nada de
  // "Cerca" — si `archiveResults` dependiera de `filtro !== 'cerca'`,
  // compartir un link de "Cerca" desde mobile dejaba el panel de escritorio
  // en blanco sin ningún mensaje, porque ninguna de sus tres ramas de
  // render contempla "archiveResults es null pero no por falta de query".
  // El fetch de acá alimenta las dos ramas (D-5 del design.md): un solo
  // fetch, no dos. Costo aceptado a propósito: con `tab=cartelera` y un `q`
  // de 2+ caracteres, este fetch corre igual aunque esa rama de escritorio
  // no lo use — es más barato que un fetch condicional por breakpoint (que
  // rompería "una sola consulta SSR" y reabriría el bug de arriba) o que
  // detectar el breakpoint en el servidor.
  const archiveResults = query.length >= 2 ? await searchCatalog(query) : null
  const archiveTotal = archiveResults
    ? archiveResults.events.length + archiveResults.artists.length + archiveResults.venues.length + archiveResults.festivals.length
    : 0

  const nearbyResult = filtro === 'cerca' ? await searchNearby(query || undefined) : null
  const mobileRows =
    filtro === 'cerca'
      ? nearbyResult?.status === 'ok'
        ? nearbyToSearchRows(nearbyResult.venues)
        : []
      : archiveResults
        ? toSearchRows(archiveResults, filtro)
        : []
  const mobileFilterLabel = filterLabel(filtro)

  return (
    <PageShell
      title="Buscar"
      action={
        <LinkButton href={routes.events.new} variant="secondary" className="px-4 py-2">
          + Cargar a mano
        </LinkButton>
      }
    >
      {/* Escritorio: dos tabs (cartelera/archivo) sin cambios de este WU,
          salvo la sección de festivales agregada en WU1 (D-5 del
          design.md). Mobile reemplaza todo esto por el chip screen de abajo
          — mismo patrón hidden/md:block que el resto del port (ver
          HomeHero.tsx). */}
      <div className="hidden md:block" data-testid="buscar-desktop">
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
              initialLocation={params.location ?? profileLocation}
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
              {source === 'future' && <FutureEventsResults events={tmEvents} searchQuery={params.artist || params.location} />}
              {source === 'past' && slConfigured && params.artist?.trim() && <SetlistResults setlists={slSetlists} />}
            </>
          )}

          {!hasQuery && source === 'future' && (
            <EmptyState title="Buscá tu música" description="Artista o ciudad para shows futuros." className="border-dashed mt-8" />
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
              {archiveResults.festivals.length > 0 && (
                <section>
                  <p className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text mb-3">
                    Festivales ({archiveResults.festivals.length})
                  </p>
                  <ul className="divide-y divide-ritual-border-subtle">
                    {archiveResults.festivals.map((festival) => {
                      const meta = festivalMetaLine(festival.edition, festival.city)
                      return (
                        <li key={festival.id}>
                          <Link href={routes.festivals.detail(festival.id)} className="flex items-center justify-between gap-4 py-3">
                            <span className="font-dense font-extrabold text-ritual-bone truncate">{festival.name}</span>
                            {meta && <span className="font-label text-xs text-ritual-gray-text whitespace-nowrap">{meta}</span>}
                          </Link>
                        </li>
                      )
                    })}
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
      </div>

      {/* Mobile: pantalla unificada de chips (buscar-mobile) — reemplaza el
          selector de tabs entero, no sólo el contenido (Requirement
          "Mobile-only branch, desktop unchanged"). */}
      <div className="md:hidden" data-testid="buscar-mobile">
        <SearchField defaultValue={query} filter={filtro} />
        <SearchFilters active={filtro} query={query} />

        <div className="pt-6">
          {filtro === 'cerca' ? (
            nearbyResult && nearbyResult.status !== 'ok' ? (
              <NearbyNotice status={nearbyResult.status} />
            ) : (
              <>
                {mobileFilterLabel && (
                  <p className="font-label text-[9px] tracking-[0.24em] uppercase text-ritual-gray-mid-2 mb-3">{mobileFilterLabel}</p>
                )}
                {mobileRows.length === 0 ? (
                  <p className="font-body text-sm text-ritual-gray-text text-center py-8">Ninguna sede guardada cerca tuyo todavía.</p>
                ) : (
                  <SearchRowList rows={mobileRows} />
                )}
              </>
            )
          ) : query.length === 0 ? (
            <p className="font-body text-sm text-ritual-gray-text text-center py-8">Buscá entre lo que ya guardaste.</p>
          ) : query.length < 2 ? (
            <p className="font-body text-sm text-ritual-gray-text text-center py-4">Escribí al menos 2 caracteres.</p>
          ) : (
            <>
              {mobileFilterLabel && (
                <p className="font-label text-[9px] tracking-[0.24em] uppercase text-ritual-gray-mid-2 mb-3">{mobileFilterLabel}</p>
              )}
              {mobileRows.length === 0 ? (
                <p className="font-body text-ritual-gray-text text-center py-8">
                  Sin resultados para <strong className="text-ritual-gray-text">&quot;{query}&quot;</strong>
                </p>
              ) : (
                <SearchRowList rows={mobileRows} />
              )}
            </>
          )}

          <Link
            href="/buscar?tab=cartelera"
            className="mt-6 inline-block font-label text-[9px] tracking-[0.14em] uppercase text-ritual-gray-mid"
          >
            ¿No está en tu archivo? Buscá en cartelera →
          </Link>
        </div>
      </div>
    </PageShell>
  )
}
