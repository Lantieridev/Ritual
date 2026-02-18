'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabase } from '@/src/core/lib/supabase'
import { getCurrentUserId } from '@/src/core/auth/session'
import { validateUUID, sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import { routes } from '@/src/core/lib/routes'

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

export async function createFestival(
    data: FestivalCreateInput
): Promise<{ error?: string }> {
    const name = sanitizeText(data.name, MAX_NAME)
    if (!name) return { error: 'El nombre del festival es obligatorio.' }
    if (!data.start_date) return { error: 'La fecha de inicio es obligatoria.' }

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
    redirect(routes.festivals.detail(newFestival.id))
}

export async function deleteFestival(id: string): Promise<{ error?: string }> {
    const idErr = validateUUID(id, 'Festival')
    if (idErr) return { error: idErr }

    const { error } = await supabase.from('festivals').delete().eq('id', id)
    if (error) {
        console.error('Error eliminando festival:', error)
        return { error: sanitizeError(error) }
    }

    revalidatePath(routes.festivals.list)
    redirect(routes.festivals.list)
}

export async function saveFestivalAttendance(
    festivalId: string,
    status: 'interested' | 'going' | 'went',
    rating?: number,
    review?: string
): Promise<{ error?: string }> {
    const idErr = validateUUID(festivalId, 'Festival')
    if (idErr) return { error: idErr }

    const userId = await getCurrentUserId()
    if (!userId) return { error: 'Usuario no autenticado' }

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
): Promise<{ error?: string }> {
    const festErr = validateUUID(festivalId, 'Festival')
    if (festErr) return { error: festErr }
    const evErr = validateUUID(eventId, 'Evento')
    if (evErr) return { error: evErr }

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
