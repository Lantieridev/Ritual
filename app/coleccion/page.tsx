import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { gql } from 'urql'
import { getClient } from '@/src/graphql/client'
import type { GraphQLArtist, GraphQLFestival, GraphQLVenue } from '@/src/core/types'
import type { Artist } from '@/src/core/types'
import { getEventsWithAttendance } from '@/src/domains/events/data'
import { aggregateEventStats } from '@/src/domains/stats/aggregate'
import { buildArtistShelves, buildCollectionTerritory, type CollectionArtist } from '@/src/domains/artists/collection-view'
import { routes } from '@/src/core/lib/routes'
import { isPastEvent } from '@/src/core/lib/dates'
import { LinkButton, EmptyState } from '@/src/core/components/ui'
import { PageShell } from '@/src/core/components/layout'
import { searchSpotifyArtist, getBestSpotifyImage, isSpotifyConfigured } from '@/src/core/lib/spotify'

export const metadata: Metadata = {
    title: 'Colección | RITUAL',
    description: 'Artistas, sedes y festivales — la forma de tu historia musical.',
}

type Tab = 'artistas' | 'sedes' | 'festivales'

interface PageProps {
    searchParams: Promise<{ tab?: Tab }>
}

async function withImage(artist: CollectionArtist) {
    if (!isSpotifyConfigured()) return { ...artist, image: null as string | null }
    const { artist: spotifyArtist } = await searchSpotifyArtist(artist.name)
    return { ...artist, image: spotifyArtist ? getBestSpotifyImage(spotifyArtist.images) : null }
}

export default async function CollectionPage({ searchParams }: PageProps) {
    const { tab = 'artistas' } = await searchParams

    return (
        <PageShell title="Colección" description="Artistas, sedes y festivales — la forma de tu historia.">
            <div className="flex border-b border-ritual-border-subtle mb-8">
                {([
                    ['artistas', 'Artistas'],
                    ['sedes', 'Sedes'],
                    ['festivales', 'Festivales'],
                ] as const).map(([value, label]) => (
                    <Link
                        key={value}
                        href={`${routes.collection}?tab=${value}`}
                        aria-current={tab === value ? 'page' : undefined}
                        className={`px-5 py-3 font-label text-[10px] tracking-[0.16em] uppercase border-b-2 -mb-px transition-colors ${tab === value ? 'border-ritual-red text-ritual-bone' : 'border-transparent text-ritual-gray-text hover:text-ritual-gray-text'
                            }`}
                    >
                        {label}
                    </Link>
                ))}
            </div>

            {tab === 'artistas' && <ArtistsShelvesView />}
            {tab === 'sedes' && <VenuesTab />}
            {tab === 'festivales' && <FestivalsTab />}
        </PageShell>
    )
}

const ArtistsTabQuery = gql`
  query CollectionArtists {
    artists { id name genre imageUrl spotifyId }
    wishlistArtistIds
  }
`

/** buildArtistShelves/buildCollectionTerritory consumen la forma del dominio. */
function toDomainArtist(artist: GraphQLArtist): Artist {
    return {
        id: artist.id,
        name: artist.name,
        genre: artist.genre,
        image_url: artist.imageUrl,
        spotify_id: artist.spotifyId,
    }
}

async function ArtistsShelvesView() {
    const [{ data }, wentEvents] = await Promise.all([
        getClient().query<{ artists: GraphQLArtist[]; wishlistArtistIds: string[] }>(
            ArtistsTabQuery,
            {}
        ).toPromise(),
        getEventsWithAttendance().then((events) => events.filter((e) => e.attendance?.[0]?.status === 'went')),
    ])
    const artists = (data?.artists ?? []).map(toDomainArtist)
    const wishlistIds = data?.wishlistArtistIds ?? []

    if (artists.length === 0) {
        return (
            <EmptyState
                title="No hay artistas cargados"
                description="Agregá un artista para poder armar lineups en los recitales."
                action={{ label: '+ Nuevo artista', href: routes.artists.new }}
            />
        )
    }

    const agg = aggregateEventStats(wentEvents.map((e) => ({ lineups: e.lineups, venues: e.venues, rating: e.attendance?.[0]?.rating ?? null })))
    const shelves = buildArtistShelves(artists, agg.topArtists, new Set(wishlistIds))
    const territory = buildCollectionTerritory(artists, agg.topArtists, agg.topVenues)

    const [core, returned, once, gaps] = await Promise.all([
        Promise.all(shelves.core.map(withImage)),
        Promise.all(shelves.returned.map(withImage)),
        Promise.all(shelves.once.map(withImage)),
        Promise.all(shelves.gaps.map(withImage)),
    ])

    return (
        <div className="space-y-12">
            <LinkButton href={routes.artists.new} variant="secondary" className="px-4 py-2 w-fit">
                + Nuevo artista
            </LinkButton>

            {territory.uniqueArtistsSeen > 0 && (
                <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <TerritoryBox label="Artistas vistos" value={territory.uniqueArtistsSeen} />
                    <TerritoryBox label="Repetidos" value={`${territory.repeatedArtists} de ${territory.uniqueArtistsSeen}`} />
                    {territory.homeVenue && <TerritoryBox label="Tu sede casa" value={territory.homeVenue.name} />}
                    {territory.topGenres[0] && <TerritoryBox label="Tu género" value={territory.topGenres[0].genre} />}
                </section>
            )}

            <ArtistShelf title="Tu núcleo duro" artists={core} />
            <ArtistShelf title="Volviste a verlas" artists={returned} />
            <ArtistShelf title="Las viste una vez" artists={once} />
            <ArtistShelf title="Los huecos — en tu wishlist" artists={gaps} />

            {shelves.catalog.length > 0 && (
                <section>
                    <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">Resto del catálogo</h2>
                    <ul className="flex flex-wrap gap-2">
                        {shelves.catalog.map((a) => (
                            <li key={a.id}>
                                <Link href={routes.artists.detail(a.id)} className="font-label text-xs text-ritual-gray-text hover:text-ritual-gray-text border border-ritual-border px-3 py-1.5 block">
                                    {a.name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    )
}

function TerritoryBox({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="border border-ritual-border bg-ritual-surface p-4 text-center">
            <p className="font-display text-2xl text-ritual-bone truncate">{value}</p>
            <p className="font-label text-[9px] tracking-[0.14em] uppercase text-ritual-gray-text mt-1">{label}</p>
        </div>
    )
}

function ArtistShelf({ title, artists }: { title: string; artists: Array<CollectionArtist & { image: string | null }> }) {
    if (artists.length === 0) return null
    return (
        <section>
            <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">{title}</h2>
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {artists.map((artist) => (
                    <li key={artist.id}>
                        <Link
                            href={routes.artists.detail(artist.id)}
                            className="group relative block overflow-hidden border border-ritual-border bg-ritual-surface hover:border-ritual-border-2 transition-colors"
                        >
                            <div className="relative aspect-square w-full overflow-hidden bg-ritual-panel">
                                {artist.image ? (
                                    <div className="absolute inset-0 ritual-photo">
                                        <Image src={artist.image} alt={artist.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 640px) 50vw, 25vw" />
                                    </div>
                                ) : (
                                    <div className="flex h-full items-center justify-center text-ritual-gray-text text-3xl select-none">♪</div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-ritual-bg/90 via-transparent to-transparent" />
                                {artist.timesSeen > 0 && (
                                    <span className="absolute top-2 right-2 font-figure text-lg text-ritual-red-hover bg-ritual-bg/70 px-1.5">{artist.timesSeen}×</span>
                                )}
                            </div>
                            <p className="font-dense font-extrabold text-sm text-ritual-bone truncate p-3">{artist.name}</p>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    )
}

const VenuesTabQuery = gql`
  query CollectionVenues {
    venues { id name city country address }
  }
`

async function VenuesTab() {
    const { data } = await getClient().query<{ venues: GraphQLVenue[] }>(VenuesTabQuery, {}).toPromise()
    const venues = data?.venues ?? []

    if (venues.length === 0) {
        return (
            <EmptyState
                title="No hay sedes cargadas"
                description="Agregá una sede para poder crear recitales."
                action={{ label: '+ Nueva sede', href: routes.venues.new }}
            />
        )
    }

    return (
        <div className="space-y-6">
            <LinkButton href={routes.venues.new} variant="secondary" className="px-4 py-2 w-fit">
                + Nueva sede
            </LinkButton>
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {venues.map((v) => (
                    <li key={v.id}>
                        <Link
                            href={routes.venues.detail(v.id)}
                            className="group flex flex-col gap-1 border border-ritual-border bg-ritual-surface p-5 hover:border-ritual-border-2 transition-colors"
                        >
                            <p className="font-subtitle font-black uppercase text-ritual-bone">{v.name}</p>
                            {(v.city || v.country) && (
                                <p className="font-label text-xs text-ritual-gray-text">{[v.city, v.country].filter(Boolean).join(', ')}</p>
                            )}
                            {v.address && <p className="font-body text-xs text-ritual-gray-text mt-0.5">{v.address}</p>}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    )
}

const FESTIVAL_STATUS_LABEL: Record<string, string> = {
    interested: 'Me interesa',
    going: 'Voy',
    went: 'Fui ✓',
}

const FestivalsTabQuery = gql`
  query CollectionFestivals {
    festivals {
      id
      name
      edition
      startDate
      city
      country
      festivalAttendance { status }
    }
  }
`

type CollectionFestival = Pick<GraphQLFestival, 'id' | 'name' | 'edition' | 'city' | 'country'> & {
    startDate: string
    festivalAttendance: Array<{ status: string }>
}

async function FestivalsTab() {
    const { data } = await getClient().query<{ festivals: CollectionFestival[] }>(
        FestivalsTabQuery,
        {}
    ).toPromise()
    const festivals = data?.festivals ?? []
    const upcoming = festivals.filter((f) => !isPastEvent(f.startDate))
    const past = festivals.filter((f) => isPastEvent(f.startDate))

    if (festivals.length === 0) {
        return (
            <EmptyState
                title="Todavía no hay festivales"
                description="Registrá los festivales a los que fuiste o que querés ir."
                action={{ label: '+ Agregar festival', href: routes.festivals.new }}
            />
        )
    }

    return (
        <div className="space-y-8">
            <LinkButton href={routes.festivals.new} variant="secondary" className="px-4 py-2 w-fit">
                + Nuevo festival
            </LinkButton>
            {upcoming.length > 0 && <FestivalList title="Próximos" festivals={upcoming} />}
            {past.length > 0 && <FestivalList title="Historial" festivals={past} />}
        </div>
    )
}

function FestivalList({ title, festivals }: { title: string; festivals: CollectionFestival[] }) {
    return (
        <section>
            <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">{title}</h2>
            <ul className="divide-y divide-ritual-border-subtle">
                {festivals.map((festival) => {
                    const status = festival.festivalAttendance?.[0]?.status
                    return (
                        <li key={festival.id}>
                            <Link href={routes.festivals.detail(festival.id)} className="group flex items-center gap-5 py-4">
                                <div className="flex-1 min-w-0">
                                    <p className="font-subtitle font-black uppercase text-ritual-bone truncate">
                                        {festival.name} {festival.edition && <span className="text-ritual-red-hover">{festival.edition}</span>}
                                    </p>
                                    <p className="font-label text-xs text-ritual-gray-text mt-0.5">{[festival.city, festival.country].filter(Boolean).join(', ')}</p>
                                </div>
                                {status && FESTIVAL_STATUS_LABEL[status] && (
                                    <span className="font-label text-[9px] uppercase tracking-[0.1em] text-ritual-red-hover border border-ritual-red/40 px-2 py-0.5 shrink-0">
                                        {FESTIVAL_STATUS_LABEL[status]}
                                    </span>
                                )}
                                <span className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-text opacity-0 group-hover:opacity-100 transition-opacity shrink-0">Ver →</span>
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}
