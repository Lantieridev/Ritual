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
