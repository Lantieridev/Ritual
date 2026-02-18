import 'server-only'
import { supabase } from '@/src/core/lib/supabase'
import { getCurrentUserId } from '@/src/core/auth/session'

export interface Festival {
    id: string
    name: string
    edition: string | null
    start_date: string
    end_date: string | null
    venue_id: string | null
    city: string | null
    country: string | null
    website: string | null
    poster_url: string | null
    notes: string | null
    created_at: string
    venues: { name: string; city: string | null } | null
    festival_events: Array<{
        id: string
        day_label: string | null
        events: {
            id: string
            name: string | null
            date: string
            lineups: Array<{ artists: { id: string; name: string } }>
        }
    }>
    festival_attendance: Array<{
        status: string
        rating: number | null
        review: string | null
    }>
}

export async function getFestivals(): Promise<Festival[]> {
    const userId = await getCurrentUserId()
    if (!userId) return []

    const { data, error } = await supabase
        .from('festivals')
        .select(`
            id, name, edition, start_date, end_date, city, country, website, poster_url, notes, created_at, venue_id,
            venues ( name, city ),
            festival_events (
                id, day_label,
                events (
                    id, name, date,
                    lineups ( artists ( id, name ) )
                )
            ),
            festival_attendance ( status, rating, review )
        `)
        .eq('festival_attendance.user_id', userId)
        .order('start_date', { ascending: false })

    if (error) {
        console.error('Error fetching festivals:', error)
        return []
    }

    return (data ?? []) as unknown as Festival[]
}

export async function getFestivalById(id: string): Promise<Festival | null> {
    const userId = await getCurrentUserId()
    if (!userId) return null
    const { data, error } = await supabase
        .from('festivals')
        .select(`
            id, name, edition, start_date, end_date, city, country, website, poster_url, notes, created_at, venue_id,
            venues ( name, city ),
            festival_events (
                id, day_label,
                events (
                    id, name, date,
                    lineups ( artists ( id, name ) )
                )
            ),
            festival_attendance ( status, rating, review )
        `)
        .eq('id', id)
        .eq('festival_attendance.user_id', userId)
        .single()

    if (error) {
        console.error('Error fetching festival:', error)
        return null
    }

    return data as unknown as Festival
}
