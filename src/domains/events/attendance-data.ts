import { createClient } from '@/src/core/lib/supabase/server'
import { getCurrentUserId } from '@/src/core/auth/session'
import type { AttendanceStatus } from './attendance-actions'

export interface EventAttendance {
    id: string
    status: AttendanceStatus
    rating: number | null
    review: string | null
    notes: string | null
}

/**
 * Obtiene el registro de asistencia (incluye rating/reseña/notas, plana
 * sobre la misma fila — ver migración
 * 20260722010000_fold_memories_into_attendance.sql) para un evento.
 * Devuelve null si el usuario no tiene attendance para ese evento.
 */
export async function getAttendanceForEvent(
    eventId: string
): Promise<EventAttendance | null> {
    const userId = await getCurrentUserId()
    if (!userId) return null

    const supabase = await createClient()
    const { data, error } = await supabase
        .from('attendance')
        .select('id, status, rating, review, notes')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .single()

    if (error || !data) return null

    return {
        id: data.id,
        status: data.status as AttendanceStatus,
        rating: data.rating,
        review: data.review,
        notes: data.notes,
    }
}

export async function getAttendanceForEventsBatch(
    eventIds: readonly string[],
    userId: string
): Promise<(EventAttendance | null)[]> {
    if (!userId || eventIds.length === 0) return eventIds.map(() => null)

    const supabase = await createClient()
    const { data, error } = await supabase
        .from('attendance')
        .select('id, event_id, status, rating, review, notes')
        .in('event_id', eventIds)
        .eq('user_id', userId)

    if (error || !data) return eventIds.map(() => null)

    const attendanceByEventId = new Map(
        data.map((row) => [
            row.event_id,
            {
                id: row.id,
                status: row.status as AttendanceStatus,
                rating: row.rating,
                review: row.review,
                notes: row.notes,
            }
        ])
    )

    return eventIds.map((id) => attendanceByEventId.get(id) ?? null)
}
