/**
 * Qué le falta cargar al usuario de un show (issue #9).
 *
 * ════════════════════════════════════════════════════════════════════════
 * AVISO POST-SHOW — issue #6 (sistema de notificaciones)
 * ════════════════════════════════════════════════════════════════════════
 * El issue #9 pide "un solo aviso que junta todo lo pendiente del show
 * (gastos + rating + reseña), no notificaciones sueltas". Ese aviso lo arma
 * el cron `notify-post-show` del dominio de notificaciones
 * (`src/domains/notifications/jobs/notifyPostShow.ts`), que reusa esta misma
 * función sin reimplementar la regla.
 *
 * Lo que vive acá es el cálculo de qué está pendiente. Es deliberadamente puro
 * y agnóstico del canal: lo consume tanto la página del evento (aviso in-app
 * durante la ventana posterior al show) como el job que encola el aviso por
 * bandeja y email. No hay infraestructura de notificaciones en este archivo.
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
