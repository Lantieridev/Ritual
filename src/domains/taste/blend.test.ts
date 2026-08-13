import { describe, it, expect } from 'vitest'
import { blendTasteProfile } from '@/src/domains/taste/blend'
import type { TasteSignal } from '@/src/domains/taste/types'

const NOW = new Date('2026-01-01T00:00:00.000Z')

function priorGenre(ref: string): TasteSignal {
    return {
        source: 'profile-prior',
        kind: 'genre',
        ref,
        weight: 1,
        observedAt: null,
        halfLifeDays: null,
        prior: true,
    }
}

function went(ref: string, rating: number, observedAt: string): TasteSignal {
    return {
        source: 'attendance',
        kind: 'artist',
        ref,
        weight: rating ? (3 * rating) / 3 : 3,
        observedAt,
        halfLifeDays: 365,
        prior: false,
    }
}

describe('blendTasteProfile — empty state', () => {
    it('is honest when there are no signals at all', () => {
        const profile = blendTasteProfile([], { now: NOW, artistGenres: new Map() })

        expect(profile.genreAffinity.size).toBe(0)
        expect(profile.artistAffinity.size).toBe(0)
        expect(profile.realSignalCount).toBe(0)
        expect(profile.hasAnySignal).toBe(false)
        expect(profile.basis).toBe('none')
    })
})

describe('blendTasteProfile — declared genres only', () => {
    it('labels declared-only taste honestly instead of hiding it', () => {
        const signals = [priorGenre('rock'), priorGenre('pop'), priorGenre('indie')]

        const profile = blendTasteProfile(signals, { now: NOW, artistGenres: new Map() })

        expect(profile.genreAffinity.size).toBe(3)
        expect(profile.genreAffinity.get('rock')).toBeGreaterThan(0)
        expect(profile.realSignalCount).toBe(0)
        expect(profile.hasAnySignal).toBe(true)
        expect(profile.basis).toBe('declared-genres')
    })
})

describe('blendTasteProfile — prior fade', () => {
    it('keeps the prior at full weight when realSignalCount is 0', () => {
        const profile = blendTasteProfile([priorGenre('rock')], { now: NOW, artistGenres: new Map() })

        expect(profile.genreAffinity.get('rock')).toBe(1)
    })

    it('halves the prior once 10 real signals exist alongside it', () => {
        const realSignals = Array.from({ length: 10 }, (_, i) =>
            went(`artist-${i}`, 0, NOW.toISOString())
        )
        const signals = [priorGenre('rock'), ...realSignals]

        const profile = blendTasteProfile(signals, { now: NOW, artistGenres: new Map() })

        expect(profile.realSignalCount).toBe(10)
        expect(profile.genreAffinity.get('rock')).toBe(0.5)
        expect(profile.basis).toBe('behavior')
    })
})

describe('blendTasteProfile — 365-day decay', () => {
    it('halves a went signal exactly one half-life later', () => {
        const oneYearAgo = new Date(NOW.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
        const signal = went('bandalos', 0, oneYearAgo)

        const profile = blendTasteProfile([signal], { now: NOW, artistGenres: new Map() })

        expect(profile.artistAffinity.get('bandalos')).toBeCloseTo(1.5, 5)
    })

    it('keeps a went signal from today at full weight', () => {
        const signal = went('bandalos', 0, NOW.toISOString())

        const profile = blendTasteProfile([signal], { now: NOW, artistGenres: new Map() })

        expect(profile.artistAffinity.get('bandalos')).toBeCloseTo(3, 5)
    })
})

describe('blendTasteProfile — rating order', () => {
    it('ranks a 5/5 went above an unrated one, and an unrated one above a 1/5', () => {
        const signals = [
            went('one-star', 1, NOW.toISOString()),
            went('unrated', 0, NOW.toISOString()),
            went('five-stars', 5, NOW.toISOString()),
        ]

        const profile = blendTasteProfile(signals, { now: NOW, artistGenres: new Map() })

        const oneStar = profile.artistAffinity.get('one-star') ?? 0
        const unrated = profile.artistAffinity.get('unrated') ?? 0
        const fiveStars = profile.artistAffinity.get('five-stars') ?? 0

        expect(oneStar).toBeLessThan(unrated)
        expect(unrated).toBeLessThan(fiveStars)
    })
})

describe('blendTasteProfile — genre weight split', () => {
    it('splits an artist signal weight evenly across its genres', () => {
        const signal = went('bandalos', 0, NOW.toISOString())
        const artistGenres = new Map([['bandalos', ['rock-nacional', 'indie']]])

        const profile = blendTasteProfile([signal], { now: NOW, artistGenres })

        expect(profile.artistAffinity.get('bandalos')).toBeCloseTo(3, 5)
        expect(profile.genreAffinity.get('rock-nacional')).toBeCloseTo(1.5, 5)
        expect(profile.genreAffinity.get('indie')).toBeCloseTo(1.5, 5)
    })
})

describe('blendTasteProfile — source-pluggable read model', () => {
    it('accepts a brand-new fixture source id with no code change', () => {
        const fixtureSignal: TasteSignal = {
            source: 'fixture-fifth-source',
            kind: 'genre',
            ref: 'shoegaze',
            weight: 4,
            observedAt: null,
            halfLifeDays: null,
            prior: false,
        }

        const profile = blendTasteProfile([fixtureSignal], { now: NOW, artistGenres: new Map() })

        expect(profile.genreAffinity.get('shoegaze')).toBe(4)
        expect(profile.sources).toEqual(['fixture-fifth-source'])
        expect(profile.basis).toBe('behavior')
    })
})
