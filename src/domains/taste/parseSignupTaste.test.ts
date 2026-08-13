import { describe, it, expect } from 'vitest'
import { parseSignupTaste } from '@/src/domains/taste/parseSignupTaste'

const VALID_GENRES = new Set(['rock-nacional', 'indie', 'pop'])
const NOW = new Date('2026-01-01T00:00:00.000Z')

describe('parseSignupTaste — valid input', () => {
    it('passes through valid genres and a plausible birth year', () => {
        const result = parseSignupTaste(
            { genres: ['rock-nacional', 'indie'], birthYear: '2000' },
            VALID_GENRES,
            NOW
        )

        expect(result.error).toBeUndefined()
        expect(result.genres).toEqual(['rock-nacional', 'indie'])
        expect(result.birthYear).toBe(2000)
    })

    it('allows skipping the birth year entirely', () => {
        const result = parseSignupTaste({ genres: ['pop'], birthYear: null }, VALID_GENRES, NOW)

        expect(result.error).toBeUndefined()
        expect(result.birthYear).toBeNull()
    })
})

describe('parseSignupTaste — birth year validation', () => {
    it('rejects a birth year older than 100 years', () => {
        const result = parseSignupTaste({ genres: ['pop'], birthYear: '1900' }, VALID_GENRES, NOW)

        expect(result.error).toBe('Revisá el año de nacimiento.')
    })

    it('rejects a birth year younger than 13 years old', () => {
        const result = parseSignupTaste({ genres: ['pop'], birthYear: '2020' }, VALID_GENRES, NOW)

        expect(result.error).toBe('Revisá el año de nacimiento.')
    })

    it('rejects a non-numeric birth year', () => {
        const result = parseSignupTaste({ genres: ['pop'], birthYear: 'abcd' }, VALID_GENRES, NOW)

        expect(result.error).toBe('Revisá el año de nacimiento.')
    })
})

describe('parseSignupTaste — genre count validation', () => {
    it('rejects more than 5 genres', () => {
        const result = parseSignupTaste(
            { genres: ['rock-nacional', 'indie', 'pop', 'jazz', 'folk', 'metal'], birthYear: null },
            VALID_GENRES,
            NOW
        )

        expect(result.error).toBe('Elegí como máximo 5 géneros.')
    })

    it('drops unknown genre keys instead of rejecting the whole signup', () => {
        const result = parseSignupTaste({ genres: ['rock-nacional', 'unknown-key'], birthYear: null }, VALID_GENRES, NOW)

        expect(result.error).toBeUndefined()
        expect(result.genres).toEqual(['rock-nacional'])
    })
})
