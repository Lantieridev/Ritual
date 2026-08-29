import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/src/core/lib/supabase/server'
import { getCurrentUserId } from '@/src/core/auth/session'
import type { UserRole } from '@/src/core/types'
import DataLoader from 'dataloader'
import { getAttendanceForEventsBatch, getEventPhotosBatch, type EventAttendance, type EventPhoto } from '@/src/domains/events/service'
import { listArtistEventsBatch, type ArtistEvent } from '@/src/domains/artists/service'
import { listVenueEventsBatch, type VenueEvent } from '@/src/domains/venues/service'

export interface GraphQLContext {
    supabase: SupabaseClient
    userId: string | null
    role: UserRole | null
    attendanceLoader: DataLoader<string, EventAttendance | null>
    photosLoader: DataLoader<string, EventPhoto[]>
    artistEventsLoader: DataLoader<string, ArtistEvent[]>
    venueEventsLoader: DataLoader<string, VenueEvent[]>
}

export async function createGraphQLContext(): Promise<GraphQLContext> {
    const supabase = await createClient()
    const userId = await getCurrentUserId()
    let role: GraphQLContext['role'] = null

    if (userId) {
        // Fetch the user's role bypassing RLS via our new function
        const { data, error } = await supabase.rpc('get_user_role', { user_id: userId })
        if (!error && data) {
            role = data as GraphQLContext['role']
        } else {
            // Fail closed to the lowest privilege, but log it — this branch can
            // fire on every request during a DB blip, silently downgrading an
            // admin/moderador session with no trace otherwise.
            if (error) {
                console.error('get_user_role RPC failed, falling back to usuario:', error)
            }
            role = 'usuario'
        }
    }

    const attendanceLoader = new DataLoader<string, EventAttendance | null>(async (keys) => {
        if (!userId) return keys.map(() => null)
        return getAttendanceForEventsBatch(keys, userId)
    })

    const photosLoader = new DataLoader<string, EventPhoto[]>(async (keys) => {
        return getEventPhotosBatch(keys)
    })

    // Igual que attendanceLoader/photosLoader arriba: sin batchear, pedir
    // `events` sobre las queries de listado (que no paginan) dispararía un
    // select anidado por fila.
    const artistEventsLoader = new DataLoader<string, ArtistEvent[]>(async (keys) => {
        return listArtistEventsBatch(keys)
    })

    const venueEventsLoader = new DataLoader<string, VenueEvent[]>(async (keys) => {
        return listVenueEventsBatch(keys)
    })

    return {
        supabase,
        userId,
        role,
        attendanceLoader,
        photosLoader,
        artistEventsLoader,
        venueEventsLoader,
    }
}
