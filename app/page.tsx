import * as React from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { listMyEvents, listUpcomingEvents } from '@/src/domains/events/service'
import type { EventWithAttendance } from '@/src/domains/events/service'
import { buildHomeFeed, buildHomeHeroState, heroEventOf, pickRecentSeen, resolveInitialOpen } from '@/src/domains/events/home-view'
import { HomeHero } from '@/src/domains/events/components/HomeHero'
import { getHeroVenueDetails } from '@/src/domains/events/hero-details'
import { gql } from 'urql'
import { getClient } from '@/src/graphql/client'
import type { GraphQLArtist, GraphQLFestival } from '@/src/core/types'
import { routes } from '@/src/core/lib/routes'
import { isPastEvent } from '@/src/core/lib/dates'
import { StarRating } from '@/src/core/components/ui'
import { getArtistImage } from '@/src/core/lib/artist-image'
import { findProfile } from '@/src/domains/auth/service'
import { getCurrentUserId } from '@/src/core/auth/session'
import { getHomeSuggestions, getFirstTimeSeeds } from '@/src/domains/recommendations/service'
import { formatReason } from '@/src/domains/recommendations/reasons'
import { SuggestionsStrip, SuggestionsStripSkeleton } from '@/src/domains/recommendations/components/SuggestionsStrip'

export const metadata: Metadata = {
  title: 'RITUAL — Tu historial de recitales',
  description: 'Registrá, recordá y revivé cada show que fuiste. Tu archivo musical personal.',
}

const HomePageQuery = gql`
  query HomePage {
    wishlistArtists { id name }
    festivals {
      id
      name
      edition
      startDate
      endDate
      city
      country
      festivalAttendance { status }
    }
  }
`

type HomeFestival = Pick<GraphQLFestival, 'id' | 'name' | 'edition' | 'city' | 'country'> & {
  startDate: string
  endDate: string | null
  festivalAttendance: Array<{ status: string }>
}

/**
 * buildHomeHeroState y el JSX de abajo consumen la forma snake_case del
 * dominio, así que la respuesta de GraphQL se traduce acá en el borde en vez
 * de reescribir home-view (y sus tests) para el rename de campos.
 */
function toHeroFestival(festival: HomeFestival) {
  return {
    id: festival.id,
    name: festival.name,
    edition: festival.edition,
    city: festival.city,
    country: festival.country,
    start_date: festival.startDate,
    end_date: festival.endDate,
    festival_attendance: festival.festivalAttendance,
  }
}

/**
 * La franja de sugerencias del home (issue #81) — reemplaza "Cerca tuyo" y
 * "En tu ciudad" por un único `getHomeSuggestions`, que ya cruza catálogo +
 * Ticketmaster contra el gusto y la ubicación de quien mira. Vive en su
 * propio Suspense (JD-006): nunca bloquea el resto de Home. `heading` le
 * llega a `getHomeSuggestions` sin `city` (esa parte no la conoce el
 * dominio de recomendaciones); acá se completa con `profile.location` antes
 * de pasarla a `SuggestionsStrip`, que es quien arma el título/nota finales
 * vía `stripHeading()`.
 */
async function SuggestionsSection({
  userId,
  wishlistArtists,
  allEvents,
  city,
  now,
}: {
  userId: string | null
  wishlistArtists: Array<Pick<GraphQLArtist, 'id' | 'name'>>
  allEvents: EventWithAttendance[]
  city: string | null
  now: Date
}) {
  const { heading, candidates } = await getHomeSuggestions(userId, wishlistArtists, allEvents, now)
  if (candidates.length === 0) return null

  return (
    <SuggestionsStrip
      heading={{ ...heading, city }}
      candidates={candidates.map((candidate) => ({
        key: candidate.key,
        href: candidate.href,
        headliner: candidate.headliner,
        venueName: candidate.venueName,
        startsAt: candidate.startsAt,
        reason: formatReason(candidate.reason, candidate.distanceKm),
        image: candidate.image,
      }))}
    />
  )
}

interface HomePageProps {
  /** `?entrada=hoy` — deep link de la banda de "Tu entrada de hoy" de vuelta a Home (issue #82). */
  searchParams?: Promise<{ entrada?: string | string[] }>
}

export default async function HomePage({ searchParams }: HomePageProps = {}) {
  const params = searchParams ? await searchParams : {}
  const [allEvents, { data }, userId] = await Promise.all([
    listMyEvents(),
    getClient().query<{
      wishlistArtists: Array<Pick<GraphQLArtist, 'id' | 'name'>>
      festivals: HomeFestival[]
    }>(HomePageQuery, {}).toPromise(),
    getCurrentUserId(),
  ])
  // getCurrentUserId() ya va cacheado por request (ver session.ts) — layout.tsx
  // y listMyEvents() ya pagan este costo, así que este llamado no suma una
  // validación de JWT nueva.
  const profile = userId ? await findProfile(userId) : null
  const festivals = (data?.festivals ?? []).map(toHeroFestival)
  const now = new Date()

  const { nextShow, byYear, years } = buildHomeFeed(allEvents, 'went', now)
  // Un visitante sin sesión no tiene shows propios: su hero sale del catálogo.
  const catalogUpcoming = userId ? [] : await listUpcomingEvents()
  const heroState = buildHomeHeroState(nextShow, festivals, now, {
    myEvents: allEvents,
    signedIn: Boolean(userId),
    catalogUpcoming,
  })

  // La foto de fondo sale del show que protagoniza el estado (el próximo, el
  // de anoche, la efeméride o el del catálogo); primera vez no lleva foto.
  const heroEvent = heroEventOf(heroState)
  const heroHeadliner = heroEvent?.lineups?.[0]?.artists.name ?? heroEvent?.name ?? null

  // No se condiciona a que Spotify esté configurado: getArtistImage prueba
  // Spotify y cae en Deezer, que no pide credenciales. Antes, sin las dos
  // variables de Spotify el hero se quedaba sin fondo — que es el caso por
  // defecto de cualquier instalación recién clonada.
  const heroImagePromise = heroHeadliner
    ? getArtistImage(heroHeadliner).then(({ image }) => image)
    : Promise.resolve(null)

  // Dirección y clima del show que protagoniza el hero mobile de Hoy — sólo
  // aplica a show-today/normal (el resto de los estados no tiene un show por
  // delante que mostrar). Nunca se espera acá: HomeHero la resuelve en su
  // propio Suspense (issue #82/#8, R1-008), así el resto del hero no queda
  // atado a que Open-Meteo responda.
  const heroDetails =
    heroState.kind === 'show-today'
      ? getHeroVenueDetails(heroState.event)
      : heroState.kind === 'normal'
        ? getHeroVenueDetails(heroState.nextShow)
        : null

  // "Lo último que viste" del hero mobile (issue #82) — sólo los shows
  // propios que el usuario ya vio, sin importar si tienen puntaje.
  const recentSeen = pickRecentSeen(allEvents, now)
  // Abre el talón de esta noche al llegar desde la banda (?entrada=hoy),
  // sólo cuando el estado sigue siendo show-today (R1-007).
  const initialOpen = resolveInitialOpen(params.entrada, heroState)

  const upcomingFestivals = festivals
    .filter((f) => !isPastEvent(f.end_date ?? f.start_date, now))
    .filter((f) => !(heroState.kind === 'festival' && f.id === heroState.festival.id))
    .slice(0, 4)

  const hasArchive = byYear && years.length > 0
  const archiveCount = allEvents.filter((e) => e.attendance?.[0]?.status === 'went').length

  // Primera vez no lleva franja de sugerencias (mock hoyVacio): no hay nada
  // propio todavía sobre lo cual afinar, y la seguridad de la semilla fija
  // vive aparte, en FirstTimeHero. Sin sesión la consume el propio GuestHero
  // (JD-006, ver más abajo); el resto de los estados la renderiza la página
  // como sección aparte, justo después del hero.
  const suggestionsElement =
    heroState.kind === 'first-time' ? null : (
      <React.Suspense fallback={<SuggestionsStripSkeleton />}>
        <SuggestionsSection
          userId={userId}
          wishlistArtists={data?.wishlistArtists ?? []}
          allEvents={allEvents}
          city={profile?.location ?? null}
          now={now}
        />
      </React.Suspense>
    )
  const isGuest = heroState.kind === 'guest'

  // Sólo primera vez lleva la escalera de semillas (issue #81) — el resto de
  // los estados ya tiene un show propio del cual partir. `userId` siempre es
  // no-nulo acá (primera vez implica sesión iniciada), el chequeo es sólo
  // para que TypeScript lo sepa. Nunca se espera: HomeHero la resuelve en su
  // propio Suspense, igual que `seeds`/`details` (R1-008).
  const seedsPromise = heroState.kind === 'first-time' && userId ? getFirstTimeSeeds(userId) : undefined

  return (
    <>
      <React.Suspense
        fallback={
          <HomeHero
            state={heroState}
            backgroundImage={null}
            suggestions={isGuest ? suggestionsElement : undefined}
            seeds={seedsPromise}
          />
        }
      >
        <HomeHero
          state={heroState}
          backgroundImage={heroImagePromise}
          details={heroDetails}
          recentSeen={recentSeen}
          initialOpen={initialOpen}
          suggestions={isGuest ? suggestionsElement : undefined}
          seeds={seedsPromise}
        />
      </React.Suspense>

      {!isGuest && suggestionsElement}

      {upcomingFestivals.length > 0 && (
        <section className="min-h-screen snap-start flex flex-col justify-center px-6 md:px-10 py-20 bg-ritual-panel">
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

      {/* Sin archivo esta sección no suma: primera vez y sin sesión ya tienen
          su propia invitación arriba, y "0 talones" no le dice nada a nadie. */}
      {hasArchive && (
      <section className="px-6 md:px-10 py-20 bg-ritual-bg">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <p className="font-label text-[10px] tracking-[0.32em] text-ritual-red-hover uppercase">Tu archivo</p>
            <h2 className="font-display text-5xl uppercase text-ritual-bone mt-2">
              {archiveCount} talones
            </h2>
          </div>
          <p className="font-body italic text-ritual-gray-text max-w-xs text-right">
            Acá el scroll se suelta: la ceremonia terminó, ahora es catálogo.
          </p>
        </div>

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

        <div className="mt-10">
          <Link
            href={routes.events.new}
            className="font-label text-[10px] tracking-[0.16em] text-ritual-gray-text uppercase border border-ritual-border px-6 py-3 inline-block"
          >
            + Cargar a mano
          </Link>
        </div>
      </section>
      )}
    </>
  )
}
