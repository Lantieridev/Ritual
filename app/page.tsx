import type { Metadata } from 'next'
import Link from 'next/link'
import { getEventsWithAttendance } from '@/src/domains/events/data'
import { buildHomeFeed, buildHomeHeroState } from '@/src/domains/events/home-view'
import { HomeHero } from '@/src/domains/events/components/HomeHero'
import { getFestivals } from '@/src/domains/festivals/data'
import { getWishlistArtistIds } from '@/src/domains/artists/wishlist-actions'
import { createClient } from '@/src/core/lib/supabase/server'
import { routes } from '@/src/core/lib/routes'
import { isPastEvent } from '@/src/core/lib/dates'
import { formatDate } from '@/src/core/lib/utils'
import { StarRating } from '@/src/core/components/ui'
import {
  isTicketmasterConfigured,
  searchTicketmasterEvents,
} from '@/src/core/lib/ticketmaster'
import {
  isSpotifyConfigured,
  searchSpotifyArtist,
  getBestSpotifyImage,
} from '@/src/core/lib/spotify'
import type { FutureEvent } from '@/src/core/types'

export const metadata: Metadata = {
  title: 'RITUAL — Tu historial de recitales',
  description: 'Registrá, recordá y revivé cada show que fuiste. Tu archivo musical personal.',
}

interface NearbyCard {
  artistName: string
  event: FutureEvent
  image: string | null
}

/**
 * "Cerca tuyo": shows futuros de tus artistas en wishlist, vía Ticketmaster.
 * Acotado a los primeros 6 artistas de la wishlist para no disparar
 * demasiadas llamadas externas en cada carga de Home — si la wishlist crece
 * mucho esto conviene moverlo a un fetch client-side diferido.
 */
async function getNearbyShows(): Promise<NearbyCard[]> {
  if (!isTicketmasterConfigured()) return []

  const artistIds = await getWishlistArtistIds()
  if (artistIds.length === 0) return []

  const supabase = await createClient()
  const { data: artists } = await supabase
    .from('artists')
    .select('id, name')
    .in('id', artistIds.slice(0, 6))

  const results = await Promise.allSettled(
    (artists ?? []).map(async (artist) => {
      const { events } = await searchTicketmasterEvents({ keyword: artist.name })
      return events.slice(0, 2).map((event) => ({ artistName: artist.name, event }))
    })
  )

  const candidates = results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => new Date(a.event.datetime).getTime() - new Date(b.event.datetime).getTime())
    .slice(0, 4)

  const withImages = await Promise.all(
    candidates.map(async (c) => {
      if (!isSpotifyConfigured()) return { ...c, image: null }
      const { artist } = await searchSpotifyArtist(c.artistName)
      return { ...c, image: artist ? getBestSpotifyImage(artist.images) : null }
    })
  )

  return withImages
}

export default async function HomePage() {
  const [allEvents, festivals] = await Promise.all([getEventsWithAttendance(), getFestivals()])
  const now = new Date()

  const { nextShow, byYear, years } = buildHomeFeed(allEvents, 'went', now)
  const heroState = buildHomeHeroState(nextShow, festivals, now)

  const heroEvent = heroState.kind === 'show-today' ? heroState.event : heroState.kind === 'normal' ? heroState.nextShow : undefined
  const heroHeadliner = heroEvent?.lineups?.[0]?.artists.name ?? heroEvent?.name ?? null
  const heroImage =
    heroHeadliner && isSpotifyConfigured()
      ? await searchSpotifyArtist(heroHeadliner).then(({ artist }) => (artist ? getBestSpotifyImage(artist.images) : null))
      : null

  const [nearbyShows, upcomingFestivals] = await Promise.all([
    getNearbyShows(),
    Promise.resolve(
      festivals
        .filter((f) => !isPastEvent(f.end_date ?? f.start_date, now))
        .filter((f) => !(heroState.kind === 'festival' && f.id === heroState.festival.id))
        .slice(0, 4)
    ),
  ])

  const hasArchive = byYear && years.length > 0

  return (
    <>
      <HomeHero state={heroState} backgroundImage={heroImage} />

      {nearbyShows.length > 0 && (
        <section className="min-h-screen flex flex-col justify-center px-6 md:px-10 py-20 bg-ritual-bg">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <p className="font-label text-[10px] tracking-[0.32em] text-ritual-red-hover uppercase">
                Cerca tuyo · próximos 90 días
              </p>
              <h2 className="font-display text-[7vh] leading-[0.9] uppercase text-ritual-bone mt-2">
                Los que no<br />te perderías
              </h2>
            </div>
            <p className="font-body italic text-ritual-gray-text max-w-xs text-right">
              Elegidos de tu wishlist.
            </p>
          </div>
          <div className="flex gap-3 h-[52vh] overflow-x-auto">
            {nearbyShows.map(({ artistName, event, image }, i) => (
              <Link
                key={`${event.id || event.title}-${i}`}
                href={routes.events.new}
                className="group relative shrink-0 basis-64 hover:basis-96 transition-[flex-basis] duration-500 overflow-hidden bg-ritual-surface"
              >
                {image && (
                  <div
                    className="absolute inset-0 ritual-photo"
                    style={{ backgroundImage: `url(${image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ritual-bg via-transparent to-transparent" />
                <div className="relative flex flex-col justify-end h-full p-4">
                  <p className="font-display text-3xl leading-[0.88] uppercase text-ritual-bone">{artistName}</p>
                  <p className="font-subtitle font-bold text-sm uppercase text-ritual-gray-light-3 mt-1">
                    {event.venue.name}
                  </p>
                  <p className="font-label text-[10px] text-ritual-gray-light-2 mt-1">
                    {formatDate(event.datetime, { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {upcomingFestivals.length > 0 && (
        <section className="min-h-screen flex flex-col justify-center px-6 md:px-10 py-20 bg-ritual-panel">
          <p className="font-label text-[10px] tracking-[0.32em] text-ritual-red-hover uppercase">Se vienen · festivales</p>
          <h2 className="font-display text-[7vh] leading-[0.9] uppercase text-ritual-bone mt-2 mb-10">
            Las romerías<br />del año
          </h2>
          <ul className="divide-y divide-ritual-border-subtle">
            {upcomingFestivals.map((f) => {
              const days = Math.max(0, Math.ceil((new Date(f.start_date).getTime() - now.getTime()) / 86400000))
              return (
                <li key={f.id}>
                  <Link
                    href={routes.festivals.detail(f.id)}
                    className="group flex items-center gap-6 py-6"
                  >
                    <div className="w-16 shrink-0">
                      <p className="font-figure text-2xl text-ritual-red-hover leading-none">{days}d</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-3xl uppercase text-ritual-bone truncate">
                        {f.name} {f.edition && <span className="text-ritual-red-hover">{f.edition}</span>}
                      </p>
                      <p className="font-label text-[10px] text-ritual-gray-text mt-1">
                        {[f.city, f.country].filter(Boolean).join(', ')}
                      </p>
                    </div>
                    <span className="font-label text-[10px] tracking-[0.16em] text-ritual-red-hover uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                      Ver →
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="px-6 md:px-10 py-20 bg-ritual-bg">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <p className="font-label text-[10px] tracking-[0.32em] text-ritual-red-hover uppercase">Tu archivo</p>
            <h2 className="font-display text-5xl uppercase text-ritual-bone mt-2">
              {allEvents.filter((e) => e.attendance?.[0]?.status === 'went').length} talones
            </h2>
          </div>
          <p className="font-body italic text-ritual-gray-text max-w-xs text-right">
            Acá el scroll se suelta: la ceremonia terminó, ahora es catálogo.
          </p>
        </div>

        {!hasArchive ? (
          <p className="font-body text-ritual-gray-text">
            Marcá shows como &quot;Fui&quot; para verlos acá.{' '}
            <Link href={routes.events.search} className="text-ritual-red-hover underline underline-offset-4">
              Buscá shows
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-10">
            {years.map((year) => (
              <div key={year}>
                <p className="font-label text-[10px] tracking-[0.14em] text-ritual-gray-text uppercase mb-3">{year}</p>
                <ul className="divide-y divide-ritual-border-subtle">
                  {byYear[year].map((ev) => {
                    const artists = ev.lineups?.map((l) => l.artists.name) ?? []
                    const rating = ev.attendance?.[0]?.rating
                    return (
                      <li key={ev.id}>
                        <Link href={routes.events.detail(ev.id)} className="group flex items-center gap-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-dense font-extrabold text-ritual-bone truncate">
                              {ev.name || artists[0] || 'Recital'}
                            </p>
                            <p className="font-label text-[10px] text-ritual-gray-text mt-0.5 truncate">
                              {ev.venues?.name}
                            </p>
                          </div>
                          {rating && <StarRating value={rating} size="xs" />}
                          <span className="font-label text-[9px] tracking-[0.16em] text-ritual-red-hover uppercase opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            Ver →
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10">
          <Link
            href={routes.events.new}
            className="font-label text-[10px] tracking-[0.16em] text-ritual-gray-text uppercase border border-ritual-border px-6 py-3 inline-block"
          >
            + Cargar a mano
          </Link>
        </div>
      </section>
    </>
  )
}
