'use server'

import { createClient } from '@/src/core/lib/supabase/server'
import { validateUUID, validateRating, sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import { getCurrentUserId } from '@/src/core/auth/session'
import type { ActionResult } from '@/src/core/types'

export type AttendanceStatus = 'interested' | 'going' | 'went'

const VALID_STATUSES: AttendanceStatus[] = ['interested', 'going', 'went']
const MAX_REVIEW_LENGTH = 2000
const MAX_NOTES_LENGTH = 5000
const MAX_ZONE_LENGTH = 100

function isValidStatus(s: unknown): s is AttendanceStatus {
    return typeof s === 'string' && VALID_STATUSES.includes(s as AttendanceStatus)
}

/**
 * Obtiene o crea el registro de attendance para un evento.
 */
export async function getOrCreateAttendance(
    eventId: string
): Promise<{ id: string; status: AttendanceStatus } | null> {
    const idErr = validateUUID(eventId, 'Evento')
    if (idErr) return null

    const userId = await getCurrentUserId()
    if (!userId) return null

    const supabase = await createClient()

    const { data: existing } = await supabase
        .from('attendance')
        .select('id, status')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .single()

    if (existing) return existing as { id: string; status: AttendanceStatus }

    const { data: created, error } = await supabase
        .from('attendance')
        .upsert(
            { event_id: eventId, user_id: userId, status: 'interested' },
            { onConflict: 'event_id,user_id', ignoreDuplicates: false }
        )
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
): Promise<ActionResult> {
    const idErr = validateUUID(eventId, 'Evento')
    if (idErr) return { error: idErr }

    if (!isValidStatus(status)) return { error: 'Estado de asistencia inválido.' }

    const userId = await getCurrentUserId()
    if (!userId) return { error: 'Usuario no autenticado' }

    const supabase = await createClient()

    const { error } = await supabase
        .from('attendance')
        .upsert(
            { event_id: eventId, user_id: userId, status },
            { onConflict: 'event_id,user_id' }
        )
    if (error) return { error: sanitizeError(error) }

    return {}
}

/**
 * Guarda o actualiza la memoria (rating + reseña + notas + protectores
 * auditivos, issue #62 + zona/sector, issue #28) de un evento. Todos los
 * campos son opcionales e independientes — omitir uno no lo toca.
 * No redirige — devuelve {} en éxito para que el cliente muestre "Guardado".
 */
export async function saveMemory(
    eventId: string,
    data: { rating?: number; review?: string; notes?: string; usedEarProtection?: boolean; zone?: string }
): Promise<ActionResult> {
    const idErr = validateUUID(eventId, 'Evento')
    if (idErr) return { error: idErr }

    if (data.rating !== undefined) {
        const ratingErr = validateRating(data.rating)
        if (ratingErr) return { error: ratingErr }
    }

    const review = data.review !== undefined
        ? sanitizeText(data.review, MAX_REVIEW_LENGTH)
        : undefined

    const notes = data.notes !== undefined
        ? sanitizeText(data.notes, MAX_NOTES_LENGTH)
        : undefined

    // '' es cómo se borra la zona (mismo criterio que ticket_url en
    // modifyEvent) -sanitizeText('') da null, que es exactamente lo que hay
    // que guardar para "borrado", no dejar la fila sin tocar.
    const zone = data.zone !== undefined
        ? sanitizeText(data.zone, MAX_ZONE_LENGTH)
        : undefined

    const attendance = await getOrCreateAttendance(eventId)
    if (!attendance) return { error: 'No se pudo obtener el registro de asistencia.' }

    const supabase = await createClient()

    const payload: {
        rating?: number
        review?: string | null
        notes?: string | null
        used_ear_protection?: boolean
        zone?: string | null
    } = {}
    if (data.rating !== undefined) payload.rating = data.rating
    if (review !== undefined) payload.review = review
    if (notes !== undefined) payload.notes = notes
    if (data.usedEarProtection !== undefined) payload.used_ear_protection = data.usedEarProtection
    if (zone !== undefined) payload.zone = zone

    const { error } = await supabase
        .from('attendance')
        .update(payload)
        .eq('id', attendance.id)
    if (error) return { error: sanitizeError(error) }

    return {}
}
