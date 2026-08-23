import { describe, it, expect } from 'vitest'
import {
    clampShowModePreferences,
    DEFAULT_SHOW_MODE_PREFERENCES,
    SHOW_MODE_LIMITS,
} from '@/src/domains/showmode/preferences'

describe('DEFAULT_SHOW_MODE_PREFERENCES', () => {
    it('defaults to 7 days before and 2 days after (the top of the "1-2 días" range the issue names)', () => {
        expect(DEFAULT_SHOW_MODE_PREFERENCES).toEqual({ daysBefore: 7, daysAfter: 2 })
    })
})

describe('clampShowModePreferences', () => {
    it('keeps values already inside the allowed range', () => {
        expect(clampShowModePreferences({ daysBefore: 14, daysAfter: 5 })).toEqual({
            daysBefore: 14,
            daysAfter: 5,
        })
    })

    it('allows zero on both ends — a user can opt out of one side of the window', () => {
        expect(clampShowModePreferences({ daysBefore: 0, daysAfter: 0 })).toEqual({
            daysBefore: 0,
            daysAfter: 0,
        })
    })

    it('clamps values above the maximum instead of writing something the table CHECK would reject', () => {
        expect(clampShowModePreferences({ daysBefore: 999, daysAfter: 999 })).toEqual({
            daysBefore: SHOW_MODE_LIMITS.maxDaysBefore,
            daysAfter: SHOW_MODE_LIMITS.maxDaysAfter,
        })
    })

    it('clamps negative values up to zero', () => {
        expect(clampShowModePreferences({ daysBefore: -5, daysAfter: -1 })).toEqual({
            daysBefore: 0,
            daysAfter: 0,
        })
    })

    it('truncates fractional input rather than storing a non-integer day count', () => {
        expect(clampShowModePreferences({ daysBefore: 7.9, daysAfter: 2.4 })).toEqual({
            daysBefore: 7,
            daysAfter: 2,
        })
    })

    it('falls back to the defaults for unreadable input instead of producing NaN', () => {
        expect(clampShowModePreferences({ daysBefore: 'abc', daysAfter: null })).toEqual(
            DEFAULT_SHOW_MODE_PREFERENCES
        )
    })

    it('falls back to the defaults for a missing object entirely', () => {
        expect(clampShowModePreferences(null)).toEqual(DEFAULT_SHOW_MODE_PREFERENCES)
        expect(clampShowModePreferences(undefined)).toEqual(DEFAULT_SHOW_MODE_PREFERENCES)
    })
})
