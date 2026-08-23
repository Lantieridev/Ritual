/**
 * Preferencias de la ventana del "modo recital activo" (issue #9).
 *
 * Puro a propósito: los defaults y el clamp los necesitan tanto el server
 * (data.ts al leer una fila que puede no existir todavía, actions.ts al
 * validar lo que manda el form) como el cliente (el form de ajustes, para
 * mostrar los límites), así que no puede vivir detrás de 'server-only'.
 */

export interface ShowModePreferences {
    /** Días antes del show en los que el modo ya está activo. */
    daysBefore: number
    /** Días después del último día del show en los que sigue activo. */
    daysAfter: number
}

/**
 * El issue pide que la ventana sea "configurable por el usuario, no un
 * número fijo de días para todos", pero no fija el default del "antes".
 * Elegimos 7: una semana es cuando uno efectivamente empieza a resolver el
 * show (transporte, plata, qué llevar), y coincide con el horizonte del
 * pronóstico útil de Open-Meteo (16 días de máximo, pero recién dentro de
 * la semana el pronóstico deja de ser ruido).
 *
 * Para el "después" el issue sí da un rango explícito — "sigue activo 1-2
 * días después" — así que se toma el techo de ese rango: 2 días. Es el
 * valor más generoso que el issue autoriza sin inventar nada.
 */
export const DEFAULT_SHOW_MODE_PREFERENCES: ShowModePreferences = {
    daysBefore: 7,
    daysAfter: 2,
}

/** Límites duros de la ventana; los mismos que valida el CHECK en la tabla. */
export const SHOW_MODE_LIMITS = {
    minDaysBefore: 0,
    maxDaysBefore: 60,
    minDaysAfter: 0,
    maxDaysAfter: 14,
} as const

function clampToRange(value: unknown, min: number, max: number, fallback: number): number {
    // `null`, `undefined` y `''` significan "no configurado", no "cero días".
    // Sin este guard caerían en el `Number()` de abajo, que los convierte en 0
    // y apagaría medio modo recital en silencio.
    if (value == null || value === '') return fallback
    const n = Number(value)
    if (!Number.isFinite(n)) return fallback
    return Math.min(max, Math.max(min, Math.trunc(n)))
}

/**
 * Normaliza cualquier entrada (form, fila de Supabase, undefined) a una
 * ventana válida. Nunca lanza ni devuelve NaN: un valor ilegible cae al
 * default en vez de dejar la página del evento sin saber si el modo está
 * activo.
 */
export function clampShowModePreferences(
    input: Partial<Record<keyof ShowModePreferences, unknown>> | null | undefined
): ShowModePreferences {
    return {
        daysBefore: clampToRange(
            input?.daysBefore,
            SHOW_MODE_LIMITS.minDaysBefore,
            SHOW_MODE_LIMITS.maxDaysBefore,
            DEFAULT_SHOW_MODE_PREFERENCES.daysBefore
        ),
        daysAfter: clampToRange(
            input?.daysAfter,
            SHOW_MODE_LIMITS.minDaysAfter,
            SHOW_MODE_LIMITS.maxDaysAfter,
            DEFAULT_SHOW_MODE_PREFERENCES.daysAfter
        ),
    }
}
