'use server'

import { redirect } from 'next/navigation'
import { supabase } from '@/src/core/lib/supabase'
import { routes } from '@/src/core/lib/routes'
import { validateUUID, validateRating, sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import { getDevUserId } from '@/src/core/lib/env'

export type AttendanceStatus = 'interested' | 'going' | 'went'

const VALID_STATUSES: AttendanceStatus[] = ['interested', 'going', 'went']
const MAX_REVIEW_LENGTH = 2000

function isValidStatus(s: unknown): s is AttendanceStatus {
    return typeof s === 'string' && VALID_STATUSES.includes(s as AttendanceStatus)
}

/**
 * Obtiene o crea el registro de attendance para un evento.
 * Devuelve el id del attendance y el status actual.
 */
export async function getOrCreateAttendance(
    eventId: string
): Promise<{ id: string; status: AttendanceStatus } | null> {
    const idErr = validateUUID(eventId, 'Evento')
    if (idErr) return null

    const userId = getDevUserId()

    const { data: existing } = await supabase
        .from('attendance')
        .select('id, status')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .single()

    if (existing) return existing as { id: string; status: AttendanceStatus }

    const { data: created, error } = await supabase
        .from('attendance')
        .insert({ event_id: eventId, user_id: userId, status: 'interested' })
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
    const idErr = validateUUID(eventId, 'Evento')
    if (idErr) return { error: idErr }

    if (!isValidStatus(status)) return { error: 'Estado de asistencia inválido.' }

    const userId = getDevUserId()

    const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .single()

    if (existing) {
        const { error } = await supabase
            .from('attendance')
            .update({ status })
            .eq('id', existing.id)
        if (error) return { error: sanitizeError(error) }
    } else {
        const { error } = await supabase
            .from('attendance')
            .insert({ event_id: eventId, user_id: userId, status })
        if (error) return { error: sanitizeError(error) }
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
    const idErr = validateUUID(eventId, 'Evento')
    if (idErr) return { error: idErr }

    // Validate rating range
    if (data.rating !== undefined) {
        const ratingErr = validateRating(data.rating)
        if (ratingErr) return { error: ratingErr }
    }

    // Sanitize review length
    const review = data.review !== undefined
        ? sanitizeText(data.review, MAX_REVIEW_LENGTH)
        : undefined

    const attendance = await getOrCreateAttendance(eventId)
    if (!attendance) return { error: 'No se pudo obtener el registro de asistencia.' }

    const { data: existing } = await supabase
        .from('memories')
        .select('id')
        .eq('attendance_id', attendance.id)
        .single()

    const payload: { rating?: number; review?: string | null } = {}
    if (data.rating !== undefined) payload.rating = data.rating
    if (review !== undefined) payload.review = review

    if (existing) {
        const { error } = await supabase
            .from('memories')
            .update(payload)
            .eq('id', existing.id)
        if (error) return { error: sanitizeError(error) }
    } else {
        const { error } = await supabase
            .from('memories')
            .insert({ attendance_id: attendance.id, ...payload })
        if (error) return { error: sanitizeError(error) }
    }

    redirect(routes.events.detail(eventId))
}
