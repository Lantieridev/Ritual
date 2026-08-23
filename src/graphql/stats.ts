import { builder } from './builder'
import { getPersonalStats } from '@/src/domains/stats/data'
import type { StatsData } from '@/src/domains/stats/data'

type TopArtist = StatsData['topArtists'][number]
type TopVenue = StatsData['topVenues'][number]
type RecentActivityEntry = StatsData['recentActivity'][number]

const TopArtistRef = builder.objectRef<TopArtist>('TopArtist')
TopArtistRef.implement({
    fields: (t) => ({
        name: t.exposeString('name'),
        count: t.exposeInt('count'),
    }),
})

const TopVenueRef = builder.objectRef<TopVenue>('TopVenue')
TopVenueRef.implement({
    fields: (t) => ({
        name: t.exposeString('name'),
        city: t.exposeString('city', { nullable: true }),
        count: t.exposeInt('count'),
    }),
})

const RecentActivityEntryRef = builder.objectRef<RecentActivityEntry>('RecentActivityEntry')
RecentActivityEntryRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        name: t.exposeString('name', { nullable: true }),
        date: t.exposeString('date'),
        venueName: t.exposeString('venueName', { nullable: true }),
        venueCity: t.exposeString('venueCity', { nullable: true }),
        status: t.exposeString('status', { nullable: true }),
        rating: t.exposeInt('rating', { nullable: true }),
    }),
})

const StatsRef = builder.objectRef<StatsData>('Stats')
StatsRef.implement({
    fields: (t) => ({
        totalShows: t.exposeInt('totalShows'),
        showsAttended: t.exposeInt('showsAttended'),
        showsGoing: t.exposeInt('showsGoing'),
        showsInterested: t.exposeInt('showsInterested'),
        uniqueArtists: t.exposeInt('uniqueArtists'),
        uniqueVenues: t.exposeInt('uniqueVenues'),
        uniqueCities: t.exposeStringList('uniqueCities'),
        uniqueCountries: t.exposeStringList('uniqueCountries'),
        // showsByYear queda como Record<string, number> (una clave por año
        // presente en el historial del usuario) — mismo criterio que
        // ExpenseSummary.byCategory/byYear en expenses.ts.
        showsByYear: t.field({ type: 'JSON', resolve: (s) => s.showsByYear }),
        topArtists: t.field({ type: [TopArtistRef], resolve: (s) => s.topArtists }),
        topVenues: t.field({ type: [TopVenueRef], resolve: (s) => s.topVenues }),
        averageRating: t.exposeFloat('averageRating', { nullable: true }),
        totalRated: t.exposeInt('totalRated'),
        // Clima (issue #8): siempre 0 hoy — getPersonalStats todavía no
        // resuelve clima por evento, ver el comentario en aggregate.ts.
        // Expuestos desde ahora para que un futuro cliente (ej. una tarjeta
        // de Wrapped) no necesite un cambio de schema para consumirlos.
        rainyShows: t.exposeInt('rainyShows'),
        totalWithWeather: t.exposeInt('totalWithWeather'),
        recentActivity: t.field({ type: [RecentActivityEntryRef], resolve: (s) => s.recentActivity }),
    }),
})

builder.queryField('myStats', (t) =>
    t.field({
        type: StatsRef,
        description: 'Estadísticas personales del usuario autenticado. Vacías si no hay sesión.',
        resolve: () => getPersonalStats(),
    })
)
