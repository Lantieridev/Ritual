import { supabase } from '@/src/core/lib/supabase'
import { getCurrentUserId } from '@/src/core/auth/session'

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

/**
 * Calcula todas las estadísticas personales del usuario.
 * Combina eventos, attendance y memories en una sola query eficiente.
 */
export async function getPersonalStats(): Promise<StatsData> {
    // Traer todos los eventos con venue, lineup, attendance y memories
    const { data: events, error } = await supabase
        .from('events')
        .select(`
      id, name, date,
      venues ( name, city, country ),
      lineups ( artists ( name ) ),
      attendance!left (
        status, user_id,
        memories ( rating )
      )
    `)
        .order('date', { ascending: false })

    if (error || !events) {
        console.error('Error cargando stats:', error)
        return emptyStats()
    }

    const userId = await getCurrentUserId()
    const now = new Date()

    // Filtrar attendance del usuario actual (RLS ya filtra, tomamos el primero si existe)
    const eventsWithMyAttendance = events.map((ev: any) => ({
        ...ev,
        myAttendance: userId ? (ev.attendance?.[0] ?? null) : null,
    }))

    const totalShows = events.length
    const showsAttended = eventsWithMyAttendance.filter((e: any) => e.myAttendance?.status === 'went').length
    const showsGoing = eventsWithMyAttendance.filter((e: any) => e.myAttendance?.status === 'going').length
    const showsInterested = eventsWithMyAttendance.filter((e: any) => e.myAttendance?.status === 'interested').length

    // Artistas únicos
    const artistSet = new Set<string>()
    const artistCount: Record<string, number> = {}
    for (const ev of events as any[]) {
        for (const l of ev.lineups ?? []) {
            const name = l.artists?.name
            if (name) {
                artistSet.add(name)
                artistCount[name] = (artistCount[name] ?? 0) + 1
            }
        }
    }

    // Venues únicos
    const venueMap: Record<string, { name: string; city: string | null; count: number }> = {}
    const citySet = new Set<string>()
    const countrySet = new Set<string>()
    for (const ev of events as any[]) {
        const v = ev.venues
        if (v?.name) {
            if (!venueMap[v.name]) venueMap[v.name] = { name: v.name, city: v.city ?? null, count: 0 }
            venueMap[v.name].count++
            if (v.city) citySet.add(v.city)
            if (v.country) countrySet.add(v.country)
        }
    }

    // Shows por año
    const showsByYear: Record<string, number> = {}
    for (const ev of events as any[]) {
        const year = new Date(ev.date).getFullYear().toString()
        showsByYear[year] = (showsByYear[year] ?? 0) + 1
    }

    // Rating promedio
    const ratings: number[] = []
    for (const ev of eventsWithMyAttendance as any[]) {
        const r = ev.myAttendance?.memories?.[0]?.rating
        if (r) ratings.push(r)
    }
    const averageRating = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null

    // Top artistas (más de 1 show)
    const topArtists = Object.entries(artistCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

    // Top venues
    const topVenues = Object.values(venueMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

    // Actividad reciente (últimos 10 shows pasados)
    const recentActivity = eventsWithMyAttendance
        .filter((e: any) => new Date(e.date) < now)
        .slice(0, 10)
        .map((e: any) => ({
            id: e.id,
            name: e.name,
            date: e.date,
            venueName: e.venues?.name ?? null,
            venueCity: e.venues?.city ?? null,
            status: e.myAttendance?.status ?? null,
            rating: e.myAttendance?.memories?.[0]?.rating ?? null,
        }))

    return {
        totalShows,
        showsAttended,
        showsGoing,
        showsInterested,
        uniqueArtists: artistSet.size,
        uniqueVenues: Object.keys(venueMap).length,
        uniqueCities: Array.from(citySet),
        uniqueCountries: Array.from(countrySet),
        showsByYear,
        topArtists,
        topVenues,
        averageRating,
        totalRated: ratings.length,
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
