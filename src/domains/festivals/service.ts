import { revalidatePath } from 'next/cache'
import { createClient } from '@/src/core/lib/supabase/server'
import { getCurrentUserId } from '@/src/core/auth/session'
import { validateUUID, validateRating, sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import { routes } from '@/src/core/lib/routes'
import type { ActionResult } from '@/src/core/types'
import { getFestivals, getFestivalById } from './data'
import type { Festival } from './data'

export type { Festival }

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
 * Use-case / application-service layer for the festivals domain.
 *
 * Server Components (app/page, app/coleccion, app/festivals/[id]) and the
 * GraphQL resolver (src/graphql/festivals.ts) call through here instead of
 * importing ./data directly — see issue #25. This is the seam: swapping the
 * data source or schema later (moving off Supabase, renaming a column) only
 * requires changes in data.ts and here, never in a page component or the
 * GraphQL layer.
 *
 * Unlike expenses, there is no cross-domain "picker" read to expose here:
 * app/festivals/nuevo doesn't need to read from another domain to render its
 * form.
 *
 * The write side lives here too, now that actions.ts is gone (issue #23):
 * GraphQL is the only transport for festival mutations, so the redirect-free
 * core functions that used to back both the Server Action and the resolver
 * only have one caller left.
 */

/** Lists the current user's festivals, most recent first. */
export async function listFestivals(): Promise<Festival[]> {
  return getFestivals()
}

/** Finds one festival by id, scoped to its owner via RLS. */
export async function findFestivalById(id: string): Promise<Festival | null> {
  return getFestivalById(id)
}

/**
 * Inserta el festival y devuelve su id. Nunca redirige — la navegación
 * después de crear la decide el cliente, que es quien dispara la mutation.
 *
 * A diferencia de eventos/artistas/sedes, los festivales quedan fuera de la
 * cola de moderación: el spec de la fase 2 (`01-spec.md` §4) los excluye del
 * scope comunitario por su complejidad (multi-día, multi-escenario) y los
 * reserva a alta top-down. El permiso se chequea acá, antes de tocar nada,
 * porque `createFestival` no tenía ninguna guarda — cualquier autenticado
 * podía crear uno directo en el catálogo compartido sin pasar por revisión.
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

    const { data: canCreate, error: roleError } = await supabase.rpc('is_moderator')
    if (roleError) {
        console.error('No se pudo verificar el rol para crear el festival:', roleError)
        return { error: sanitizeError(roleError) }
    }
    if (!canCreate) {
        return { error: 'Solo un moderador puede crear un festival.' }
    }

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

/** Borra el festival. Nunca redirige — misma razón que insertFestival. */
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

/**
 * Vincula un evento a un día del festival. Sigue la misma regla de
 * `insertFestival`: sólo quien puede crear el festival tiene sentido que le
 * arme el line-up de días/eventos.
 */
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

    const { data: canLink, error: roleError } = await supabase.rpc('is_moderator')
    if (roleError) {
        console.error('No se pudo verificar el rol para vincular el evento al festival:', roleError)
        return { error: sanitizeError(roleError) }
    }
    if (!canLink) {
        return { error: 'Solo un moderador puede vincular un evento a un festival.' }
    }

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
