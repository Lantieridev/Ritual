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
    /**
     * Shows con clima conocido y lluvia en el momento (issue #8). Siempre 0
     * hoy: getPersonalStats todavía no resuelve clima por evento (pediría un
     * fetch a Open-Meteo por show pasado en cada carga de stats, sin caché —
     * ver el comentario en aggregate.ts). El campo ya existe y
     * aggregateEventStats ya lo cuenta para que una futura tarjeta de
     * Wrapped ("fuiste a N shows bajo la lluvia") solo tenga que resolver
     * `weather` por evento antes de llamar a esta función, no reimplementar
     * el conteo.
     */
    rainyShows: number
    totalWithWeather: number
    /** % de shows con respuesta a protectores auditivos que la usó — issue #62. */
    earProtectionShows: number
    totalWithEarProtectionAnswer: number
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
    used_ear_protection: boolean | null
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
        usedEarProtection: ev.myAttendance?.used_ear_protection ?? null,
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

    // Se parte de `attendance` filtrada por usuario y se embeben los eventos,
    // no al revés. La versión anterior traía la tabla `events` COMPLETA —el
    // catálogo compartido entre todos los usuarios, con venue, lineup y
    // attendance— y recién después descartaba en JS las filas sin attendance
    // propia. Era la única lectura del catálogo sin la cota MAX_EVENTS que sí
    // aplican getEvents y getEventsWithAttendance, y su costo crecía con el
    // catálogo entero en vez de con el historial del usuario. Pega en dos
    // páginas: /stats y /wrapped.
    const supabase = await createClient()
    const { data: rows, error } = await supabase
        .from('attendance')
        .select(`
      status, user_id, rating, used_ear_protection,
      events (
        id, name, date,
        venues ( name, city, country ),
        lineups ( artists ( name ) )
      )
    `)
        .eq('user_id', userId)

    if (error || !rows) {
        console.error('Error cargando stats:', error)
        return emptyStats()
    }

    type AttendanceRow = RawAttendance & { events: Omit<RawEvent, 'attendance'> | null }

    // El orden por fecha descendente se hacía en la query anterior; acá se
    // ordena en memoria porque el embed no admite ordenar por columna de la
    // tabla embebida, y el conjunto es el historial de un solo usuario.
    const userEvents: EventWithMyAttendance[] = (rows as unknown as AttendanceRow[])
        .filter((row): row is AttendanceRow & { events: Omit<RawEvent, 'attendance'> } => row.events !== null)
        .map((row) => ({
            ...row.events,
            attendance: [{ status: row.status, user_id: row.user_id, rating: row.rating, used_ear_protection: row.used_ear_protection }],
            myAttendance: { status: row.status, user_id: row.user_id, rating: row.rating, used_ear_protection: row.used_ear_protection },
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

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
        rainyShows: agg.rainyShows,
        totalWithWeather: agg.totalWithWeather,
        earProtectionShows: agg.earProtectionShows,
        totalWithEarProtectionAnswer: agg.totalWithEarProtectionAnswer,
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
        rainyShows: 0,
        totalWithWeather: 0,
        earProtectionShows: 0,
        totalWithEarProtectionAnswer: 0,
        recentActivity: [],
    }
}
