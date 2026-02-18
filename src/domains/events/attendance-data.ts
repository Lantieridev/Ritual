import { supabase } from '@/src/core/lib/supabase'
import type { AttendanceStatus } from './attendance-actions'

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

export interface AttendanceWithMemory {
    id: string
    status: AttendanceStatus
    memory: {
        id: string
        rating: number | null
        review: string | null
    } | null
}

/**
 * Obtiene el registro de asistencia + memoria para un evento.
 * Devuelve null si el usuario no tiene attendance para ese evento.
 */
export async function getAttendanceForEvent(
    eventId: string
): Promise<AttendanceWithMemory | null> {
    const { data, error } = await supabase
        .from('attendance')
        .select(`
      id,
      status,
      memories ( id, rating, review )
    `)
        .eq('event_id', eventId)
        .eq('user_id', DEV_USER_ID)
        .single()

    if (error || !data) return null

    const memory = Array.isArray(data.memories)
        ? (data.memories[0] ?? null)
        : (data.memories ?? null)

    return {
        id: data.id,
        status: data.status as AttendanceStatus,
        memory: memory as AttendanceWithMemory['memory'],
    }
}
