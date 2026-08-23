/**
 * Armado del checklist pre-show (issue #9).
 *
 * El issue pide "una plantilla base única configurada una vez, más ítems
 * puntuales agregables por show". Eso son tres fuentes de datos que hay que
 * combinar en una sola lista para la UI:
 *   - los ítems de la plantilla (texto compartido por todos los shows),
 *   - el tilde de cada ítem de plantilla en ESTE show,
 *   - los ítems ad-hoc de este show (texto y tilde propios).
 *
 * Puro y sin Supabase para poder testear el merge y el progreso sin base de
 * datos, y para que la misma función sirva tanto en el server component que
 * arma la página como en el cliente al re-renderizar tras un tilde.
 */

/** Ítem de la plantilla base del usuario (tabla checklist_template_items). */
export interface ChecklistTemplateItem {
    id: string
    label: string
    position: number
}

/** Ítem puntual de un show (tabla event_checklist_items). */
export interface EventChecklistItem {
    id: string
    label: string
    position: number
    checked: boolean
}

/** Tilde de un ítem de plantilla en un show (tabla event_checklist_checks). */
export interface EventChecklistCheck {
    templateItemId: string
    checked: boolean
}

/**
 * Una línea del checklist ya resuelto. `source` distingue de dónde viene
 * porque la UI las trata distinto: un ítem de plantilla no se borra desde
 * el show (se edita en los ajustes, y borrarlo ahí lo saca de todos los
 * shows), uno ad-hoc sí.
 */
export interface ResolvedChecklistItem {
    /** id del ítem de plantilla o del ítem ad-hoc, según `source`. */
    id: string
    label: string
    checked: boolean
    source: 'template' | 'adhoc'
}

function byPositionThenLabel(
    a: { position: number; label: string },
    b: { position: number; label: string }
): number {
    if (a.position !== b.position) return a.position - b.position
    return a.label.localeCompare(b.label, 'es')
}

/**
 * Combina plantilla + tildes + ítems ad-hoc en la lista que ve el usuario.
 * La plantilla va primero (es lo que se repite show a show), los ad-hoc
 * después, cada bloque ordenado por `position`.
 *
 * Un ítem de plantilla sin fila de tilde para este show cuenta como no
 * tildado: las filas de `event_checklist_checks` se crean recién cuando el
 * usuario toca el ítem, así que su ausencia es el estado inicial normal, no
 * un dato faltante.
 */
export function buildEventChecklist(
    templateItems: ChecklistTemplateItem[],
    adHocItems: EventChecklistItem[],
    checks: EventChecklistCheck[]
): ResolvedChecklistItem[] {
    const checkedTemplateIds = new Set(
        checks.filter((c) => c.checked).map((c) => c.templateItemId)
    )

    const fromTemplate: ResolvedChecklistItem[] = [...templateItems]
        .sort(byPositionThenLabel)
        .map((item) => ({
            id: item.id,
            label: item.label,
            checked: checkedTemplateIds.has(item.id),
            source: 'template' as const,
        }))

    const fromShow: ResolvedChecklistItem[] = [...adHocItems]
        .sort(byPositionThenLabel)
        .map((item) => ({
            id: item.id,
            label: item.label,
            checked: item.checked,
            source: 'adhoc' as const,
        }))

    return [...fromTemplate, ...fromShow]
}

export interface ChecklistProgress {
    done: number
    total: number
    /** 0..1. Una lista vacía da 0, no NaN. */
    ratio: number
    isComplete: boolean
}

/** Cuántos ítems están tildados sobre el total. Una lista vacía nunca está completa. */
export function checklistProgress(items: ResolvedChecklistItem[]): ChecklistProgress {
    const total = items.length
    const done = items.filter((i) => i.checked).length
    return {
        done,
        total,
        ratio: total === 0 ? 0 : done / total,
        isComplete: total > 0 && done === total,
    }
}
