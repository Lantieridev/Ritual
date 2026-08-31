'use server'

/**
 * Escrituras del "modo recital activo" (issue #9).
 *
 * Todas devuelven el `ActionResult<T>` compartido y ninguna redirige: el
 * checklist y los ajustes se manipulan sin salir de la página, igual que el
 * panel de gastos del issue #7. Cada action revalida el usuario por su
 * cuenta — el `user_id` nunca llega desde el cliente, siempre sale de la
 * sesión, así que un id ajeno en el payload no puede escribir nada.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/src/core/lib/supabase/server'
import { getCurrentUserId } from '@/src/core/auth/session'
import { validateUUID, sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import { routes } from '@/src/core/lib/routes'
import { clampShowModePreferences } from './preferences'
import type { ShowModePreferences } from './preferences'
import type { ActionResult } from '@/src/core/types'

/** Tope de texto de un ítem de checklist — una línea, no una nota. */
const MAX_CHECKLIST_LABEL_LENGTH = 120

/**
 * Tope de ítems por lista (plantilla y ad-hoc, cada una por su lado). No es
 * una restricción de producto sino un freno a que un bug de cliente en un
 * loop llene la tabla; 50 ítems ya es una lista pre-show absurdamente larga.
 */
const MAX_CHECKLIST_ITEMS = 50

/** Guarda la ventana del modo recital. Los valores se clampean a los límites de la tabla. */
export async function saveShowModePreferences(
    input: ShowModePreferences
): Promise<ActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) return { error: 'Usuario no autenticado' }

    const prefs = clampShowModePreferences(input)

    const supabase = await createClient()
    const { error } = await supabase.from('user_preferences').upsert(
        {
            id: userId,
            show_mode_days_before: prefs.daysBefore,
            show_mode_days_after: prefs.daysAfter,
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
    )
    if (error) return { error: sanitizeError(error) }

    revalidatePath(routes.showMode)
    return {}
}

async function countRows(table: string, userId: string, eventId?: string): Promise<number> {
    const supabase = await createClient()
    let query = supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId)
    if (eventId) query = query.eq('event_id', eventId)
    const { count } = await query
    return count ?? 0
}

/** Agrega un ítem a la plantilla base. Se ubica al final de la lista. */
export async function addChecklistTemplateItem(
    label: string
): Promise<ActionResult<{ id?: string; label?: string; position?: number }>> {
    const userId = await getCurrentUserId()
    if (!userId) return { error: 'Usuario no autenticado' }

    const clean = sanitizeText(label, MAX_CHECKLIST_LABEL_LENGTH)
    if (!clean) return { error: 'El ítem no puede estar vacío.' }

    if ((await countRows('checklist_template_items', userId)) >= MAX_CHECKLIST_ITEMS) {
        return { error: `La plantilla ya tiene ${MAX_CHECKLIST_ITEMS} ítems.` }
    }

    const supabase = await createClient()
    const { data: last } = await supabase
        .from('checklist_template_items')
        .select('position')
        .eq('user_id', userId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle()

    const position = (last?.position ?? -1) + 1

    const { data, error } = await supabase
        .from('checklist_template_items')
        .insert({ user_id: userId, label: clean, position })
        .select('id, label, position')
        .single()

    if (error || !data) return { error: sanitizeError(error) }

    revalidatePath(routes.showMode)
    return { id: data.id, label: data.label, position: data.position }
}

/**
 * Borra un ítem de la plantilla. Los tildes que ese ítem tenga en cualquier
 * show se van con él por el ON DELETE CASCADE de event_checklist_checks — no
 * hay que limpiarlos a mano.
 */
export async function removeChecklistTemplateItem(id: string): Promise<ActionResult> {
    const idErr = validateUUID(id, 'Ítem')
    if (idErr) return { error: idErr }

    const userId = await getCurrentUserId()
    if (!userId) return { error: 'Usuario no autenticado' }

    const supabase = await createClient()
    const { data: deleted, error } = await supabase
        .from('checklist_template_items')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .select('id')
    if (error) return { error: sanitizeError(error) }
    // Un DELETE que RLS bloquea (id ajeno) no es un error para PostgREST,
    // afecta 0 filas y devuelve error: null -mismo patrón que removeEvent.
    if (!deleted || deleted.length === 0) return { error: 'No se pudo eliminar el ítem.' }

    revalidatePath(routes.showMode)
    return {}
}

/** Agrega un ítem puntual a un show, sin tocar la plantilla base. */
export async function addEventChecklistItem(
    eventId: string,
    label: string
): Promise<ActionResult<{ id?: string; label?: string; position?: number }>> {
    const idErr = validateUUID(eventId, 'Evento')
    if (idErr) return { error: idErr }

    const userId = await getCurrentUserId()
    if (!userId) return { error: 'Usuario no autenticado' }

    const clean = sanitizeText(label, MAX_CHECKLIST_LABEL_LENGTH)
    if (!clean) return { error: 'El ítem no puede estar vacío.' }

    if ((await countRows('event_checklist_items', userId, eventId)) >= MAX_CHECKLIST_ITEMS) {
        return { error: `Este show ya tiene ${MAX_CHECKLIST_ITEMS} ítems propios.` }
    }

    const supabase = await createClient()
    const { data: last } = await supabase
        .from('event_checklist_items')
        .select('position')
        .eq('user_id', userId)
        .eq('event_id', eventId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle()

    const position = (last?.position ?? -1) + 1

    const { data, error } = await supabase
        .from('event_checklist_items')
        .insert({ user_id: userId, event_id: eventId, label: clean, position, checked: false })
        .select('id, label, position')
        .single()

    if (error || !data) return { error: sanitizeError(error) }

    revalidatePath(routes.events.detail(eventId))
    return { id: data.id, label: data.label, position: data.position }
}

/** Borra un ítem puntual de un show. */
export async function removeEventChecklistItem(
    eventId: string,
    id: string
): Promise<ActionResult> {
    const eventErr = validateUUID(eventId, 'Evento')
    if (eventErr) return { error: eventErr }
    const idErr = validateUUID(id, 'Ítem')
    if (idErr) return { error: idErr }

    const userId = await getCurrentUserId()
    if (!userId) return { error: 'Usuario no autenticado' }

    const supabase = await createClient()
    const { data: deleted, error } = await supabase
        .from('event_checklist_items')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .select('id')
    if (error) return { error: sanitizeError(error) }
    if (!deleted || deleted.length === 0) return { error: 'No se pudo eliminar el ítem.' }

    revalidatePath(routes.events.detail(eventId))
    return {}
}

/**
 * Tilda o destilda un ítem del checklist de un show.
 *
 * El `source` decide dónde vive el estado, y es la razón por la que esta
 * action no puede ser una sola tabla: un ítem ad-hoc guarda su tilde en su
 * propia fila, mientras que uno de plantilla lo guarda en
 * event_checklist_checks contra (usuario, evento, ítem) — la plantilla es
 * compartida por todos los shows y no puede tener un estado tildado global.
 */
export async function setChecklistItemChecked(
    eventId: string,
    itemId: string,
    source: 'template' | 'adhoc',
    checked: boolean
): Promise<ActionResult> {
    const eventErr = validateUUID(eventId, 'Evento')
    if (eventErr) return { error: eventErr }
    const idErr = validateUUID(itemId, 'Ítem')
    if (idErr) return { error: idErr }
    if (source !== 'template' && source !== 'adhoc') {
        return { error: 'Origen de ítem inválido.' }
    }

    const userId = await getCurrentUserId()
    if (!userId) return { error: 'Usuario no autenticado' }

    const supabase = await createClient()

    if (source === 'adhoc') {
        const { error } = await supabase
            .from('event_checklist_items')
            .update({ checked })
            .eq('id', itemId)
            .eq('user_id', userId)
            .eq('event_id', eventId)
        if (error) return { error: sanitizeError(error) }
        return {}
    }

    const { error } = await supabase.from('event_checklist_checks').upsert(
        {
            user_id: userId,
            event_id: eventId,
            template_item_id: itemId,
            checked,
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,event_id,template_item_id' }
    )
    if (error) return { error: sanitizeError(error) }

    return {}
}
