/**
 * Capa de casos de uso del "modo recital activo" (issue #9).
 *
 * Misma razón que expenses/service.ts y festivals/service.ts (ver issue
 * #25): la página del evento y la de ajustes hablan con esto, nunca con
 * ./data directamente. Acá viven las orquestaciones — resolver el rango del
 * show, combinar plantilla + tildes + ítems del show, calcular la fase y los
 * pendientes — para que el componente de página solo consuma un objeto ya
 * armado.
 *
 * Las escrituras (saveShowModePreferences, el CRUD de ítems de checklist) se
 * definen en ./actions.ts, no acá, porque ya validan y devuelven
 * `ActionResult<T>` con su propia forma — pero se reexportan abajo para que
 * `app/` tenga un solo punto de entrada al dominio, igual que en el resto.
 */
import {
    getShowModePreferences,
    getChecklistTemplateItems,
    getEventChecklistState,
    getShowDateRange,
} from './data'
import { resolveShowModeWindow, describeShowModePhase } from './window'
import { buildEventChecklist, checklistProgress } from './checklist'
import { computePendingForShow, isMemoryCardReady } from './pending'
import {
    saveShowModePreferences,
    addChecklistTemplateItem,
    removeChecklistTemplateItem,
    addEventChecklistItem,
    removeEventChecklistItem,
    setChecklistItemChecked,
} from './actions'
import type { ShowModeWindow } from './window'
import type { ResolvedChecklistItem, ChecklistProgress, ChecklistTemplateItem } from './checklist'
import type { PendingItem, ShowCompletionInput } from './pending'
import type { ShowModePreferences } from './preferences'

export {
    saveShowModePreferences,
    addChecklistTemplateItem,
    removeChecklistTemplateItem,
    addEventChecklistItem,
    removeEventChecklistItem,
    setChecklistItemChecked,
}

export interface EventShowModeState {
    window: ShowModeWindow
    /** Etiqueta corta de la fase ("Faltan 3 días"), null si el modo no está activo. */
    phaseLabel: string | null
    checklist: ResolvedChecklistItem[]
    progress: ChecklistProgress
    /** Lo que falta cargar del show — ver la nota de dependencia en ./pending. */
    pending: PendingItem[]
    /** La tarjeta recuerdo se ofrece completa recién cuando no queda nada pendiente. */
    memoryCardReady: boolean
}

/**
 * Estado completo del modo recital para un show puntual.
 *
 * Recibe la asistencia/gastos ya cargados por la página en vez de volver a
 * pedirlos: la ficha del evento ya los trae para el panel de gastos y el
 * form de rating, y repetir esas dos queries acá sería trabajo duplicado en
 * cada render de la página.
 */
export async function getEventShowModeState(
    event: { id: string; date: string },
    userId: string | null,
    completion: ShowCompletionInput
): Promise<EventShowModeState> {
    const [preferences, range, templateItems, checklistState] = await Promise.all([
        getShowModePreferences(userId),
        getShowDateRange(event),
        getChecklistTemplateItems(userId),
        getEventChecklistState(userId, event.id),
    ])

    const window = resolveShowModeWindow(range, preferences)
    const checklist = buildEventChecklist(
        templateItems,
        checklistState.adHocItems,
        checklistState.checks
    )
    const pending = computePendingForShow(completion)

    return {
        window,
        phaseLabel: describeShowModePhase(window),
        checklist,
        progress: checklistProgress(checklist),
        pending,
        memoryCardReady: isMemoryCardReady(pending),
    }
}

export interface ShowModeSettings {
    preferences: ShowModePreferences
    templateItems: ChecklistTemplateItem[]
}

/** Lo que necesita la página de ajustes: la ventana y la plantilla base. */
export async function getShowModeSettings(userId: string | null): Promise<ShowModeSettings> {
    const [preferences, templateItems] = await Promise.all([
        getShowModePreferences(userId),
        getChecklistTemplateItems(userId),
    ])
    return { preferences, templateItems }
}
