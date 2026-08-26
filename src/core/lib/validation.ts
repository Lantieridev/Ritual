/**
 * Input validation utilities for server actions.
 * All validation is done server-side — never trust client input.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validates that a string is a well-formed UUID v4.
 * Use this on every ID parameter received by server actions.
 */
export function isValidUUID(value: unknown): value is string {
    return typeof value === 'string' && UUID_REGEX.test(value)
}

/**
 * Returns an error string if the UUID is invalid, null if valid.
 */
export function validateUUID(value: unknown, fieldName = 'ID'): string | null {
    if (!isValidUUID(value)) return `${fieldName} inválido.`
    return null
}

/**
 * Clamps a string to a maximum length and trims whitespace.
 * Returns null if the result is empty.
 */
export function sanitizeText(
    value: string | undefined | null,
    maxLength: number
): string | null {
    if (!value) return null
    return value.trim().slice(0, maxLength) || null
}

/**
 * Validates that a rating is an integer between 1 and 5.
 */
export function validateRating(value: unknown): string | null {
    if (value === undefined || value === null) return null // optional
    const n = Number(value)
    if (!Number.isInteger(n) || n < 1 || n > 5) {
        return 'El rating debe ser un número entero entre 1 y 5.'
    }
    return null
}

/**
 * Validates a date string is a parseable ISO date.
 */
export function validateDate(value: unknown): string | null {
    if (!value || typeof value !== 'string') return 'La fecha es obligatoria.'
    const d = new Date(value)
    if (isNaN(d.getTime())) return 'La fecha no es válida.'
    return null
}

/**
 * Returns the URL unchanged only if it's a safe http(s) link, otherwise null.
 * Use this on any user-supplied URL (profile.website, festival.website, etc.)
 * before rendering it as an <a href>— an unchecked string lets a stored
 * "javascript:" URI execute in the visitor's session when clicked.
 */
export function safeHref(value: string | null | undefined): string | null {
    if (!value) return null
    try {
        const url = new URL(value.trim())
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
        return url.toString()
    } catch {
        return null
    }
}

/**
 * Parses a "?year=" query param into a valid year, falling back to
 * `fallback` for anything that isn't a real integer year (missing, "abc",
 * "2024.5", out-of-range) instead of letting NaN leak into the page.
 */
export function parseYearParam(raw: string | undefined, fallback: number): number {
    if (!raw) return fallback
    const n = Number.parseInt(raw, 10)
    if (!Number.isInteger(n) || n < 1900 || n > 9999) return fallback
    return n
}

/**
 * Sanitizes an error before returning it to the client.
 * Strips internal Supabase/Postgres details that could leak schema info.
 */
export function sanitizeError(error: { message?: string } | null | undefined): string {
    if (!error?.message) return 'Ocurrió un error inesperado.'

    // Map known Postgres/Supabase error codes to friendly messages
    const msg = error.message
    if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
        return 'Ya existe un registro con esos datos.'
    }
    if (msg.includes('foreign key') || msg.includes('violates')) {
        return 'Los datos referenciados no existen o son inválidos.'
    }
    if (msg.includes('not-null') || msg.includes('null value')) {
        return 'Faltan campos obligatorios.'
    }
    if (msg.includes('check constraint')) {
        return 'Los datos no cumplen con los requisitos.'
    }
    if (msg.includes('permission denied') || msg.includes('RLS')) {
        return 'No tenés permiso para realizar esta acción.'
    }

    // Generic fallback — never expose raw DB messages in production
    if (process.env.NODE_ENV === 'development') return msg
    return 'Ocurrió un error inesperado. Intentá de nuevo.'
}

/**
 * Sanitizes a Supabase Auth error before returning it to the client.
 * Separate from sanitizeError because Auth error messages are a different
 * vocabulary than Postgres errors (and some, like "Invalid login credentials",
 * are already intentionally generic — Supabase itself doesn't distinguish
 * "wrong password" from "no such user" to avoid leaking which emails are
 * registered). Only maps a known allowlist of safe, actionable messages;
 * anything unrecognized falls back to a generic message instead of leaking
 * the raw Supabase Auth error text.
 */
export function sanitizeAuthError(error: { message?: string } | null | undefined): string {
    if (!error?.message) return 'Ocurrió un error inesperado.'

    const msg = error.message.toLowerCase()

    if (msg.includes('invalid login credentials')) {
        return 'Email o contraseña incorrectos.'
    }
    if (msg.includes('email not confirmed')) {
        return 'Confirmá tu email antes de iniciar sesión.'
    }
    if (msg.includes('password should be at least') || msg.includes('password is too short')) {
        return 'La contraseña debe tener al menos 6 caracteres.'
    }
    if (msg.includes('same password') || msg.includes('should be different')) {
        return 'La nueva contraseña debe ser diferente a la anterior.'
    }
    if (msg.includes('unable to validate email address') || msg.includes('invalid email')) {
        return 'El email no es válido.'
    }
    if (msg.includes('rate limit') || msg.includes('too many requests')) {
        return 'Demasiados intentos. Probá de nuevo en unos minutos.'
    }
    if (msg.includes('token') || msg.includes('expired') || msg.includes('session') || msg.includes('jwt')) {
        return 'El enlace de recuperación es inválido o venció. Solicitá uno nuevo.'
    }

    if (process.env.NODE_ENV === 'development') return error.message
    return 'Ocurrió un error inesperado. Intentá de nuevo.'
}

/**
 * Neutraliza los comodines de LIKE en un término de búsqueda del usuario.
 *
 * Sin esto, un `%` ensancha el patrón a toda la tabla y un `_` matchea
 * cualquier carácter: en la búsqueda global devuelve resultados que nadie
 * pidió, y en el buscador de fusión de la cola de moderación eso pasa justo
 * antes de elegir el destino de una operación destructiva.
 *
 * La barra invertida va primero para no re-escapar las que agregan las dos
 * líneas siguientes.
 */
export function escapeLikeWildcards(term: string): string {
    return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}
