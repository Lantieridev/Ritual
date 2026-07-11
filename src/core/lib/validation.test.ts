import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  isValidUUID,
  validateUUID,
  sanitizeText,
  validateRating,
  validateDate,
  sanitizeError,
  sanitizeAuthError,
} from '@/src/core/lib/validation'

describe('isValidUUID', () => {
  it('accepts a well-formed UUID', () => {
    expect(isValidUUID('11111111-1111-1111-1111-111111111111')).toBe(true)
  })

  it('rejects malformed strings, non-strings, null and undefined', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false)
    expect(isValidUUID('11111111-1111-1111-1111-11111111111')).toBe(false) // one char short
    expect(isValidUUID(12345)).toBe(false)
    expect(isValidUUID(null)).toBe(false)
    expect(isValidUUID(undefined)).toBe(false)
  })
})

describe('validateUUID', () => {
  it('returns null for a valid UUID', () => {
    expect(validateUUID('11111111-1111-1111-1111-111111111111')).toBeNull()
  })

  it('returns a message with the given field name for an invalid UUID', () => {
    expect(validateUUID('bad', 'Evento')).toBe('Evento inválido.')
  })

  it('defaults the field name to "ID"', () => {
    expect(validateUUID('bad')).toBe('ID inválido.')
  })
})

describe('sanitizeText', () => {
  it('trims whitespace', () => {
    expect(sanitizeText('  hola  ', 100)).toBe('hola')
  })

  it('truncates to maxLength', () => {
    expect(sanitizeText('A'.repeat(300), 200)).toHaveLength(200)
  })

  it('returns null for empty, whitespace-only, null or undefined input', () => {
    expect(sanitizeText('', 100)).toBeNull()
    expect(sanitizeText('   ', 100)).toBeNull()
    expect(sanitizeText(null, 100)).toBeNull()
    expect(sanitizeText(undefined, 100)).toBeNull()
  })
})

describe('validateRating', () => {
  it('accepts integers 1 through 5', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      expect(validateRating(n)).toBeNull()
    }
  })

  it('rejects 0, 6, decimals, and non-numeric values', () => {
    expect(validateRating(0)).toBeTruthy()
    expect(validateRating(6)).toBeTruthy()
    expect(validateRating(3.5)).toBeTruthy()
    expect(validateRating('abc')).toBeTruthy()
  })

  it('treats undefined/null as valid (optional field)', () => {
    expect(validateRating(undefined)).toBeNull()
    expect(validateRating(null)).toBeNull()
  })
})

describe('validateDate', () => {
  it('accepts a parseable ISO date string', () => {
    expect(validateDate('2024-01-01')).toBeNull()
  })

  it('rejects missing, non-string, and unparseable dates', () => {
    expect(validateDate(undefined)).toBeTruthy()
    expect(validateDate('')).toBeTruthy()
    expect(validateDate(12345)).toBeTruthy()
    expect(validateDate('not-a-date')).toBeTruthy()
  })
})

describe('sanitizeError', () => {
  const originalEnv = process.env.NODE_ENV

  afterEach(() => {
    vi.stubEnv('NODE_ENV', originalEnv ?? 'test')
  })

  it('returns a generic message for a null/undefined error', () => {
    expect(sanitizeError(null)).toBe('Ocurrió un error inesperado.')
    expect(sanitizeError(undefined)).toBe('Ocurrió un error inesperado.')
  })

  it('maps known Postgres error patterns to friendly Spanish messages', () => {
    expect(sanitizeError({ message: 'duplicate key value violates unique constraint' }))
      .toBe('Ya existe un registro con esos datos.')
    expect(sanitizeError({ message: 'insert or update violates foreign key constraint' }))
      .toBe('Los datos referenciados no existen o son inválidos.')
    expect(sanitizeError({ message: 'null value in column "user_id" of relation "attendance"' }))
      .toBe('Faltan campos obligatorios.')
    expect(sanitizeError({ message: 'value fails check constraint "rating_range"' }))
      .toBe('Los datos no cumplen con los requisitos.')
    expect(sanitizeError({ message: 'permission denied for table events' }))
      .toBe('No tenés permiso para realizar esta acción.')
  })

  it('never leaks the raw DB message in production for unmapped errors', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(sanitizeError({ message: 'relation "internal_secrets" does not exist' }))
      .toBe('Ocurrió un error inesperado. Intentá de nuevo.')
  })

  it('surfaces the raw message in development for debugging', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(sanitizeError({ message: 'some obscure pg error' })).toBe('some obscure pg error')
  })
})

describe('sanitizeAuthError', () => {
  const originalEnv = process.env.NODE_ENV

  afterEach(() => {
    vi.stubEnv('NODE_ENV', originalEnv ?? 'test')
  })

  it('returns a generic message for a null/undefined error', () => {
    expect(sanitizeAuthError(null)).toBe('Ocurrió un error inesperado.')
    expect(sanitizeAuthError(undefined)).toBe('Ocurrió un error inesperado.')
  })

  it('maps known Supabase Auth error messages to friendly Spanish text', () => {
    expect(sanitizeAuthError({ message: 'Invalid login credentials' }))
      .toBe('Email o contraseña incorrectos.')
    expect(sanitizeAuthError({ message: 'Email not confirmed' }))
      .toBe('Confirmá tu email antes de iniciar sesión.')
    expect(sanitizeAuthError({ message: 'Password should be at least 6 characters' }))
      .toBe('La contraseña debe tener al menos 6 caracteres.')
    expect(sanitizeAuthError({ message: 'Unable to validate email address: invalid format' }))
      .toBe('El email no es válido.')
    expect(sanitizeAuthError({ message: 'Email rate limit exceeded' }))
      .toBe('Demasiados intentos. Probá de nuevo en unos minutos.')
  })

  it('is case-insensitive when matching known messages', () => {
    expect(sanitizeAuthError({ message: 'INVALID LOGIN CREDENTIALS' }))
      .toBe('Email o contraseña incorrectos.')
  })

  it('never leaks a raw, unrecognized Supabase Auth message in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(sanitizeAuthError({ message: 'relation "auth.users" does not exist' }))
      .toBe('Ocurrió un error inesperado. Intentá de nuevo.')
  })

  it('surfaces the raw message in development for debugging', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(sanitizeAuthError({ message: 'some obscure auth error' })).toBe('some obscure auth error')
  })
})
