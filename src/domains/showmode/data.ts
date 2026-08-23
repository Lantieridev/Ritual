/**
 * Lecturas del "modo recital activo" (issue #9) contra Supabase.
 *
 * Todo lo de acá es por usuario y RLS ya lo garantiza (las políticas son
 * `auth.uid() = user_id`), pero igual se filtra por `user_id` en la query:
 * es la convención del resto del proyecto y hace explícito el alcance sin
 * depender solo de la política.
 *
 * Ninguna de estas funciones lanza — un error de Supabase se loguea y se
 * devuelve el estado vacío/por defecto. El modo recital es una capa
 * acompañante sobre la ficha del evento: si falla, la ficha tiene que seguir
 * abriendo igual, como ya hace el clima.
 */
import 'server-only'
import { createClient } from '@/src/core/lib/supabase/server'
import { clampShowModePreferences, DEFAULT_SHOW_MODE_PREFERENCES } from './preferences'
import type { ShowModePreferences } from './preferences'
import type { ShowDateRange } from './window'
import type { ChecklistTemplateItem, EventChecklistItem, EventChecklistCheck } from './checklist'

/**
 * La ventana configurada por el usuario. Sin fila en user_preferences
 * (usuario que nunca entró a los ajustes, que es el caso normal) devuelve
 * los defaults en vez de forzar un INSERT en una lectura.
 */
export async function getShowModePreferences(
    userId: string | null
): Promise<ShowModePreferences> {
    if (!userId) return DEFAULT_SHOW_MODE_PREFERENCES

    const supabase = await createClient()
    const { data, error } = await supabase
        .from('user_preferences')
        .select('show_mode_days_before, show_mode_days_after')
        .eq('id', userId)
        .maybeSingle()

    if (error) {
        console.error('Error leyendo user_preferences:', error)
        return DEFAULT_SHOW_MODE_PREFERENCES
    }
    if (!data) return DEFAULT_SHOW_MODE_PREFERENCES

    return clampShowModePreferences({
        daysBefore: data.show_mode_days_before,
        daysAfter: data.show_mode_days_after,
    })
}

/** La plantilla base única del usuario, ordenada como la ve en los ajustes. */
export async function getChecklistTemplateItems(
    userId: string | null
): Promise<ChecklistTemplateItem[]> {
    if (!userId) return []

    const supabase = await createClient()
    const { data, error } = await supabase
        .from('checklist_template_items')
        .select('id, label, position')
        .eq('user_id', userId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error leyendo checklist_template_items:', error)
        return []
    }
    return (data ?? []) as ChecklistTemplateItem[]
}

export interface EventChecklistState {
    adHocItems: EventChecklistItem[]
    checks: EventChecklistCheck[]
}

/** Lo puntual de un show: ítems ad-hoc y tildes sobre la plantilla. */
export async function getEventChecklistState(
    userId: string | null,
    eventId: string
): Promise<EventChecklistState> {
    if (!userId) return { adHocItems: [], checks: [] }

    const supabase = await createClient()
    const [itemsResult, checksResult] = await Promise.all([
        supabase
            .from('event_checklist_items')
            .select('id, label, position, checked')
            .eq('user_id', userId)
            .eq('event_id', eventId)
            .order('position', { ascending: true })
            .order('created_at', { ascending: true }),
        supabase
            .from('event_checklist_checks')
            .select('template_item_id, checked')
            .eq('user_id', userId)
            .eq('event_id', eventId),
    ])

    if (itemsResult.error) {
        console.error('Error leyendo event_checklist_items:', itemsResult.error)
    }
    if (checksResult.error) {
        console.error('Error leyendo event_checklist_checks:', checksResult.error)
    }

    return {
        adHocItems: (itemsResult.data ?? []) as EventChecklistItem[],
        checks: (checksResult.data ?? []).map((row) => ({
            templateItemId: row.template_item_id as string,
            checked: row.checked as boolean,
        })),
    }
}

/**
 * El rango de días que ocupa un show, para medir la ventana contra él.
 *
 * El issue pide que el modo "aplique igual a festivales multi-día,
 * activándose desde el primer día". Un evento suelto ocupa su propia fecha;
 * uno que es día de un festival ocupa TODO el festival, así que la ventana
 * previa se cuenta desde el primer día y la posterior desde el último. Sin
 * esto, el día 1 de un festival de tres días saldría de la ventana antes de
 * que el festival terminara.
 *
 * Un evento puede estar en varios festivales (la tabla puente lo permite);
 * se toma el primero, que en la práctica es el único caso real.
 */
export async function getShowDateRange(event: {
    id: string
    date: string
}): Promise<ShowDateRange> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('festival_events')
        .select('festivals ( start_date, end_date )')
        .eq('event_id', event.id)
        .limit(1)
        .maybeSingle()

    if (error) {
        console.error('Error resolviendo el festival de un evento:', error)
        return { startDate: event.date }
    }

    const festival = (data as { festivals?: { start_date: string; end_date: string | null } | null } | null)
        ?.festivals
    if (!festival?.start_date) return { startDate: event.date }

    return { startDate: festival.start_date, endDate: festival.end_date }
}
