/**
 * Qué le falta cargar al usuario de un show (issue #9).
 *
 * ════════════════════════════════════════════════════════════════════════
 * DEPENDENCIA — issue #6 (sistema de notificaciones), NO implementado
 * ════════════════════════════════════════════════════════════════════════
 * El issue #9 pide "un solo aviso que junta todo lo pendiente del show
 * (gastos + rating + reseña), no notificaciones sueltas". Ese aviso necesita
 * un canal (mail/push) que todavía no existe: el issue #6 está frenado
 * esperando una decisión de tooling del dueño del proyecto.
 *
 * Lo que SÍ vive acá es la mitad que no depende de esa decisión: el cálculo
 * de qué está pendiente. Es deliberadamente puro y agnóstico del canal —
 * hoy lo consume la propia página del evento para mostrar el aviso in-app
 * durante la ventana posterior al show, y cuando el issue #6 se destrabe,
 * el job que mande el mail/push puede reusar esta misma función sin
 * reimplementar la regla. No hay nada de infraestructura de notificaciones
 * en este archivo ni en este PR.
 */

export type PendingKind = 'attendance' | 'expenses' | 'rating' | 'review'

export interface PendingItem {
    kind: PendingKind
    label: string
}

export interface ShowCompletionInput {
    /** null cuando el usuario nunca marcó nada para este show. */
    attendanceStatus: 'interested' | 'going' | 'went' | null
    expenseCount: number
    rating: number | null
    review: string | null
}

/**
 * Lo que falta cargar de un show, en el orden en que conviene resolverlo.
 *
 * Si el usuario todavía no confirmó que fue, ese es el ÚNICO pendiente que
 * se devuelve: todo lo demás (gastos de esa noche, rating, reseña) cuelga de
 * esa respuesta, y listar cuatro pendientes cuando el primero puede
 * invalidar a los otros tres convierte el aviso en ruido. Es exactamente lo
 * que el issue quiere evitar al pedir "un solo aviso" en vez de
 * notificaciones sueltas.
 */
export function computePendingForShow(input: ShowCompletionInput): PendingItem[] {
    if (input.attendanceStatus !== 'went') {
        return [{ kind: 'attendance', label: 'Confirmar si fuiste' }]
    }

    const pending: PendingItem[] = []
    if (input.expenseCount <= 0) {
        pending.push({ kind: 'expenses', label: 'Cargar los gastos de esa noche' })
    }
    if (input.rating == null) {
        pending.push({ kind: 'rating', label: 'Puntuar el show' })
    }
    if (!input.review?.trim()) {
        pending.push({ kind: 'review', label: 'Escribir la reseña' })
    }
    return pending
}

/**
 * La tarjeta recuerdo se genera "al terminar de cargar todo de un show" —
 * o sea, cuando no queda ningún pendiente.
 *
 * El clima queda fuera de esta condición a propósito: no lo carga el
 * usuario, lo trae Open-Meteo, y puede faltar por razones ajenas (sede sin
 * coordenadas, show fuera del rango histórico). Bloquear el recuerdo por
 * eso castigaría al usuario por algo que no puede resolver — la tarjeta
 * simplemente omite el clima cuando no hay.
 */
export function isMemoryCardReady(pending: PendingItem[]): boolean {
    return pending.length === 0
}
