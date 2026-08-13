/**
 * Validates the signup form's taste fields before they go into
 * `raw_user_meta_data`. Pure, no I/O — the trigger (see
 * `20260912030000_signup_taste_metadata.sql`) validates the same shape again
 * server-side as defense in depth, since `raw_user_meta_data` can be reached
 * outside this form.
 */
import type { ActionResult } from '@/src/core/types'

const MAX_GENRES = 5
const BIRTH_YEAR_PATTERN = /^\d{4}$/
const MIN_AGE_YEARS = 13
const MAX_AGE_YEARS = 100

export interface SignupTasteInput {
    genres: readonly string[]
    birthYear: string | null
}

export type ParsedSignupTaste = ActionResult<{ genres?: string[]; birthYear?: number | null }>

export function parseSignupTaste(
    input: SignupTasteInput,
    validGenreKeys: ReadonlySet<string>,
    now: Date = new Date()
): ParsedSignupTaste {
    if (input.genres.length > MAX_GENRES) {
        return { error: 'Elegí como máximo 5 géneros.' }
    }

    const genres = [...new Set(input.genres)].filter((key) => validGenreKeys.has(key))

    const birthYearInput = input.birthYear?.trim()
    if (!birthYearInput) {
        return { genres, birthYear: null }
    }

    const currentYear = now.getFullYear()
    const year = Number(birthYearInput)
    const isPlausible =
        BIRTH_YEAR_PATTERN.test(birthYearInput) &&
        year >= currentYear - MAX_AGE_YEARS &&
        year <= currentYear - MIN_AGE_YEARS

    if (!isPlausible) {
        return { error: 'Revisá el año de nacimiento.' }
    }

    return { genres, birthYear: year }
}
