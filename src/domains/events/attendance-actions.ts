'use server'

import { redirect } from 'next/navigation'
import { supabase } from '@/src/core/lib/supabase'
import { routes } from '@/src/core/lib/routes'

export type AttendanceStatus = 'interested' | 'going' | 'went'

// En modo single-player usamos un UUID fijo como user_id.
// Cuando se implemente auth real, reemplazar por auth.uid().
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Obtiene o crea el registro de attendance para un evento.
 * Devuelve el id del attendance y el status actual.
 */
export async function getOrCreateAttendance(
    eventId: string
): Promise<{ id: string; status: AttendanceStatus } | null> {
    // Buscar existente
    const { data: existing } = await supabase
        .from('attendance')
        .select('id, status')
        .eq('event_id', eventId)
        .eq('user_id', DEV_USER_ID)
        .single()

    if (existing) return existing as { id: string; status: AttendanceStatus }

    // Crear nuevo
    const { data: created, error } = await supabase
        .from('attendance')
        .insert({ event_id: eventId, user_id: DEV_USER_ID, status: 'interested' })
        .select('id, status')
        .single()

    if (error || !created) {
        console.error('Error creando attendance:', error)
        return null
    }
    return created as { id: string; status: AttendanceStatus }
}

/**
 * Actualiza el status de asistencia de un evento.
 */
export async function setAttendanceStatus(
    eventId: string,
    status: AttendanceStatus
): Promise<{ error?: string }> {
    // Buscar attendance existente
    const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', DEV_USER_ID)
        .single()

    if (existing) {
        const { error } = await supabase
            .from('attendance')
            .update({ status })
            .eq('id', existing.id)
        if (error) return { error: error.message }
    } else {
        const { error } = await supabase
            .from('attendance')
            .insert({ event_id: eventId, user_id: DEV_USER_ID, status })
        if (error) return { error: error.message }
    }

    return {}
}

/**
 * Guarda o actualiza la memoria (rating + reseña) de un evento.
 */
export async function saveMemory(
    eventId: string,
    data: { rating?: number; review?: string }
): Promise<{ error?: string }> {
    // Obtener o crear attendance primero
    const attendance = await getOrCreateAttendance(eventId)
    if (!attendance) return { error: 'No se pudo obtener el registro de asistencia.' }

    // Buscar memory existente
    const { data: existing } = await supabase
        .from('memories')
        .select('id')
        .eq('attendance_id', attendance.id)
        .single()

    const payload: { rating?: number; review?: string } = {}
    if (data.rating !== undefined) payload.rating = data.rating
    if (data.review !== undefined) payload.review = data.review

    if (existing) {
        const { error } = await supabase
            .from('memories')
            .update(payload)
            .eq('id', existing.id)
        if (error) return { error: error.message }
    } else {
        const { error } = await supabase
            .from('memories')
            .insert({ attendance_id: attendance.id, ...payload })
        if (error) return { error: error.message }
    }

    redirect(routes.events.detail(eventId))
}
