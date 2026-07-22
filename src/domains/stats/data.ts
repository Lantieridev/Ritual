import { createClient } from '@/src/core/lib/supabase/server'
import { getCurrentUserId } from '@/src/core/auth/session'
import { isPastEvent, eventYear } from '@/src/core/lib/dates'
import { aggregateEventStats, type AggregatableEvent } from '@/src/domains/stats/aggregate'

export { aggregateEventStats } from '@/src/domains/stats/aggregate'
export type { AggregatableEvent, AggregatedEventStats } from '@/src/domains/stats/aggregate'

export interface StatsData {
    totalShows: number
    showsAttended: number
    showsGoing: number        // status === 'going' (upcoming shows user plans to attend)
    showsInterested: number   // status === 'interested'
    uniqueArtists: number
    uniqueVenues: number
    uniqueCities: string[]
    uniqueCountries: string[]
    showsByYear: Record<string, number>
    topArtists: Array<{ name: string; count: number }>
    topVenues: Array<{ name: string; city: string | null; count: number }>
    averageRating: number | null
    totalRated: number
    recentActivity: Array<{
        id: string
        name: string | null
        date: string
        venueName: string | null
        venueCity: string | null
        status: string | null
        rating: number | null
    }>
}

type RawAttendance = {
    status: string | null
    user_id: string
    rating: number | null
}

type RawEvent = {
    id: string
    name: string | null
    date: string
    venues: { name: string; city: string | null; country: string | null } | null
    lineups: Array<{ artists: { name: string } | null }>
    attendance: RawAttendance[]
}

type EventWithMyAttendance = RawEvent & { myAttendance: RawAttendance | null }

function toAggregatable(ev: EventWithMyAttendance): AggregatableEvent {
    return {
        lineups: ev.lineups,
        venues: ev.venues,
        rating: ev.myAttendance?.rating ?? null,
    }
}

/**
 * Calcula todas las estadísticas personales del usuario.
 * Combina eventos y attendance (rating incluido) en una sola query eficiente.
 */
export async function getPersonalStats(): Promise<StatsData> {
    // Sin sesión no hay stats personales que mostrar — no tiene sentido
    // traer el catálogo entero de eventos (compartido entre todos los
    // usuarios) solo para filtrarlo a [] después.
    const userId = await getCurrentUserId()
    if (!userId) return emptyStats()

    // Traer todos los eventos con venue, lineup y attendance (rating incluido)
    const supabase = await createClient()
    const { data: events, error } = await supabase
        .from('events')
        .select(`
      id, name, date,
      venues ( name, city, country ),
      lineups ( artists ( name ) ),
      attendance!left (
        status, user_id, rating
      )
    `)
        .order('date', { ascending: false })

    if (error || !events) {
        console.error('Error cargando stats:', error)
        return emptyStats()
    }

    const rawEvents = events as unknown as RawEvent[]

    // Filtrar attendance del usuario actual (RLS ya filtra, tomamos el primero si existe)
    const eventsWithMyAttendance: EventWithMyAttendance[] = rawEvents.map((ev) => ({
        ...ev,
        myAttendance: ev.attendance?.[0] ?? null,
    }))

    // Solo cuentan para las stats personales los eventos donde tengo attendance registrada
    const userEvents = eventsWithMyAttendance.filter((e) => e.myAttendance !== null)

    const totalShows = userEvents.length
    const showsAttended = userEvents.filter((e) => e.myAttendance?.status === 'went').length
    const showsGoing = userEvents.filter((e) => e.myAttendance?.status === 'going').length
    const showsInterested = userEvents.filter((e) => e.myAttendance?.status === 'interested').length

    // Shows por año (de mis shows)
    const showsByYear: Record<string, number> = {}
    for (const ev of userEvents) {
        const year = eventYear(ev.date).toString()
        showsByYear[year] = (showsByYear[year] ?? 0) + 1
    }

    const agg = aggregateEventStats(userEvents.map(toAggregatable))
    const topArtists = agg.topArtists.slice(0, 5)
    const topVenues = agg.topVenues.slice(0, 5)

    // Actividad reciente (últimos 10 shows pasados)
    const recentActivity = userEvents
        .filter((e) => isPastEvent(e.date))
        .slice(0, 10)
        .map((e) => ({
            id: e.id,
            name: e.name,
            date: e.date,
            venueName: e.venues?.name ?? null,
            venueCity: e.venues?.city ?? null,
            status: e.myAttendance?.status ?? null,
            rating: e.myAttendance?.rating ?? null,
        }))

    return {
        totalShows,
        showsAttended,
        showsGoing,
        showsInterested,
        uniqueArtists: agg.uniqueArtists,
        uniqueVenues: agg.uniqueVenues,
        uniqueCities: agg.uniqueCities,
        uniqueCountries: agg.uniqueCountries,
        showsByYear,
        topArtists,
        topVenues,
        averageRating: agg.averageRating,
        totalRated: agg.totalRated,
        recentActivity,
    }
}

function emptyStats(): StatsData {
    return {
        totalShows: 0,
        showsAttended: 0,
        showsGoing: 0,
        showsInterested: 0,
        uniqueArtists: 0,
        uniqueVenues: 0,
        uniqueCities: [],
        uniqueCountries: [],
        showsByYear: {},
        topArtists: [],
        topVenues: [],
        averageRating: null,
        totalRated: 0,
        recentActivity: [],
    }
}
