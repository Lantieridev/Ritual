'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { getCurrentUserId } from '@/src/core/auth/session'
import { validateUUID, validateRating, sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import { routes } from '@/src/core/lib/routes'
import type { ActionResult } from '@/src/core/types'

const MAX_NAME = 200
const MAX_EDITION = 100
const MAX_CITY = 100
const MAX_COUNTRY = 100
const MAX_NOTES = 5000

export interface FestivalCreateInput {
    name: string
    edition?: string
    start_date: string
    end_date?: string
    city?: string
    country?: string
    website?: string
    notes?: string
}

/**
 * Inserta el festival y devuelve su id — sin redirigir. Misma razón que
 * insertVenue/insertArtist: la mutation de GraphQL nunca debería redirigir,
 * eso queda para la Server Action que sí maneja el submit de un formulario.
 */
export async function insertFestival(
    data: FestivalCreateInput
): Promise<ActionResult<{ id?: string }>> {
    const userId = await getCurrentUserId()
    if (!userId) return { error: 'Usuario no autenticado' }

    const name = sanitizeText(data.name, MAX_NAME)
    if (!name) return { error: 'El nombre del festival es obligatorio.' }
    if (!data.start_date) return { error: 'La fecha de inicio es obligatoria.' }

    const supabase = await createClient()
    const { data: newFestival, error } = await supabase
        .from('festivals')
        .insert({
            name,
            edition: sanitizeText(data.edition, MAX_EDITION),
            start_date: data.start_date,
            end_date: data.end_date || null,
            city: sanitizeText(data.city, MAX_CITY),
            country: sanitizeText(data.country, MAX_COUNTRY),
            website: data.website?.trim() || null,
            notes: sanitizeText(data.notes, MAX_NOTES),
        })
        .select('id')
        .single()

    if (error || !newFestival) {
        console.error('Error creando festival:', error)
        return { error: sanitizeError(error) }
    }

    revalidatePath(routes.festivals.list)
    return { id: newFestival.id }
}

export async function createFestival(
    data: FestivalCreateInput
): Promise<ActionResult> {
    const result = await insertFestival(data)
    if (result.error || !result.id) return result
    redirect(routes.festivals.detail(result.id))
}

/** Borra el festival sin redirigir — misma razón que insertFestival. */
export async function removeFestival(id: string): Promise<ActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) return { error: 'Usuario no autenticado' }

    const idErr = validateUUID(id, 'Festival')
    if (idErr) return { error: idErr }

    const supabase = await createClient()
    const { error } = await supabase.from('festivals').delete().eq('id', id)
    if (error) {
        console.error('Error eliminando festival:', error)
        return { error: sanitizeError(error) }
    }

    revalidatePath(routes.festivals.list)
    return {}
}

export async function deleteFestival(id: string): Promise<ActionResult> {
    const result = await removeFestival(id)
    if (result.error) return result
    redirect(routes.festivals.list)
}

export async function saveFestivalAttendance(
    festivalId: string,
    status: 'interested' | 'going' | 'went',
    rating?: number,
    review?: string
): Promise<ActionResult> {
    const idErr = validateUUID(festivalId, 'Festival')
    if (idErr) return { error: idErr }

    const ratingErr = validateRating(rating)
    if (ratingErr) return { error: ratingErr }

    const userId = await getCurrentUserId()
    if (!userId) return { error: 'Usuario no autenticado' }

    const supabase = await createClient()
    const { error } = await supabase
        .from('festival_attendance')
        .upsert(
            {
                festival_id: festivalId,
                user_id: userId,
                status,
                rating: rating ?? null,
                review: sanitizeText(review, 2000),
            },
            { onConflict: 'user_id,festival_id' }
        )

    if (error) {
        console.error('Error guardando asistencia al festival:', error)
        return { error: sanitizeError(error) }
    }

    revalidatePath(routes.festivals.detail(festivalId))
    return {}
}

export async function linkEventToFestival(
    festivalId: string,
    eventId: string,
    dayLabel?: string
): Promise<ActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) return { error: 'Usuario no autenticado' }

    const festErr = validateUUID(festivalId, 'Festival')
    if (festErr) return { error: festErr }
    const evErr = validateUUID(eventId, 'Evento')
    if (evErr) return { error: evErr }

    const supabase = await createClient()
    const { error } = await supabase
        .from('festival_events')
        .insert({
            festival_id: festivalId,
            event_id: eventId,
            day_label: sanitizeText(dayLabel, 50),
        })

    if (error) {
        console.error('Error vinculando evento al festival:', error)
        return { error: sanitizeError(error) }
    }

    revalidatePath(routes.festivals.detail(festivalId))
    return {}
}
