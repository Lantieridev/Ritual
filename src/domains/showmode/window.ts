/**
 * La ventana del "modo recital activo" (issue #9): cuándo la app se activa
 * alrededor de un show y en qué fase está.
 *
 * Puro, sin Supabase: recibe el rango del show ya resuelto y las
 * preferencias del usuario, y responde en qué fase cae la fecha de
 * referencia. Todas las comparaciones pasan por `daysUntil`, o sea por día
 * calendario en la timezone de la app — nunca por instantes exactos, por la
 * misma razón que documenta src/core/lib/dates.ts (un show "de hoy" no
 * puede leerse como pasado durante casi todo el día).
 */
import { daysUntil } from '@/src/core/lib/dates'
import type { ShowModePreferences } from './preferences'

/**
 * - `upcoming`: falta más que la ventana configurada; el modo todavía no arrancó.
 * - `before`: dentro de la ventana previa, el show no empezó.
 * - `during`: el show está ocurriendo (para festivales, cualquier día entre
 *   el primero y el último, inclusive).
 * - `after`: ya terminó pero la ventana sigue abierta — el issue pide
 *   explícitamente que "no corte en seco", para dar lugar a cargar gastos y
 *   notas pendientes.
 * - `closed`: la ventana posterior ya venció.
 */
export type ShowModePhase = 'upcoming' | 'before' | 'during' | 'after' | 'closed'

/** Rango de días que ocupa un show. `endDate` solo difiere en festivales multi-día. */
export interface ShowDateRange {
    /** Primer día del show (o del festival). */
    startDate: string
    /** Último día; si falta o es anterior al primero, se asume un show de un solo día. */
    endDate?: string | null
}

export interface ShowModeWindow {
    phase: ShowModePhase
    /** `true` en before/during/after — o sea, cuando la app "acompaña" el show. */
    isActive: boolean
    /** Días calendario hasta el primer día. 0 es hoy, negativo ya empezó. */
    daysUntilStart: number
    /** Días calendario desde el último día. 0 es hoy, negativo todavía no terminó. */
    daysSinceEnd: number
    /** Festival multi-día: el show ocupa más de una fecha. */
    isMultiDay: boolean
    /** La configuración con la que se resolvió esta ventana (para mostrarla en la UI). */
    preferences: ShowModePreferences
}

/**
 * Resuelve la fase de la ventana para un show.
 *
 * Festivales: el issue dice que "aplica igual a festivales multi-día,
 * activándose desde el primer día". Por eso la ventana previa se mide contra
 * `startDate` y la posterior contra `endDate` — un festival de tres días
 * está `during` los tres días completos, no solo el primero.
 *
 * Un `endDate` inválido o anterior al comienzo se ignora en vez de romper:
 * se trata como show de un día. Es data cargada a mano (festivals.end_date
 * es nullable), así que no puede tumbar la ficha del evento.
 */
export function resolveShowModeWindow(
    range: ShowDateRange,
    preferences: ShowModePreferences,
    reference: Date = new Date()
): ShowModeWindow {
    const startDate = range.startDate
    const rawEnd = range.endDate
    const daysUntilStart = daysUntil(startDate, reference)

    // Un end_date anterior al start_date es data inconsistente: se descarta y
    // el show pasa a valer por un solo día.
    const endCandidate = rawEnd ?? startDate
    const daysUntilEndCandidate = daysUntil(endCandidate, reference)
    const usesRealEnd = daysUntilEndCandidate >= daysUntilStart
    const daysUntilEnd = usesRealEnd ? daysUntilEndCandidate : daysUntilStart
    const isMultiDay = usesRealEnd && daysUntilEnd > daysUntilStart

    const daysSinceEnd = -daysUntilEnd

    let phase: ShowModePhase
    if (daysUntilStart > preferences.daysBefore) {
        phase = 'upcoming'
    } else if (daysUntilStart > 0) {
        phase = 'before'
    } else if (daysUntilEnd >= 0) {
        phase = 'during'
    } else if (daysSinceEnd <= preferences.daysAfter) {
        phase = 'after'
    } else {
        phase = 'closed'
    }

    return {
        phase,
        isActive: phase === 'before' || phase === 'during' || phase === 'after',
        daysUntilStart,
        daysSinceEnd,
        isMultiDay,
        preferences,
    }
}

/**
 * Texto corto de la fase, para la banda del modo activo. Devuelve null
 * cuando el modo no está activo — no hay nada que anunciar.
 */
export function describeShowModePhase(window: ShowModeWindow): string | null {
    switch (window.phase) {
        case 'before': {
            const d = window.daysUntilStart
            return d === 1 ? 'Es mañana' : `Faltan ${d} días`
        }
        case 'during':
            return window.isMultiDay ? 'Está pasando' : 'Es hoy'
        case 'after': {
            // `after` solo se alcanza con el último día ya vencido, así que
            // daysSinceEnd siempre es >= 1 acá.
            const d = window.daysSinceEnd
            return d === 1 ? 'Fue ayer' : `Fue hace ${d} días`
        }
        default:
            return null
    }
}
