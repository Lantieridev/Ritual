import { describe, it, expect } from 'vitest'
import { computeAchievements } from './achievements'
import type { StatsData } from './data'

function makeStats(overrides: Partial<StatsData> = {}): StatsData {
    return {
        totalShows: 0,
        showsAttended: 0,
        showsGoing: 0,
        showsInterested: 0,
        uniqueArtists: 0,
        uniqueVenues: 0,
        uniqueCities: [],
        uniqueCountries: [],
        showsByYear: {},
        topArtists: [],
        topVenues: [],
        averageRating: null,
        totalRated: 0,
        rainyShows: 0,
        totalWithWeather: 0,
        earProtectionShows: 0,
        totalWithEarProtectionAnswer: 0,
        recentActivity: [],
        ...overrides,
    }
}

describe('computeAchievements', () => {
    it('ninguno desbloqueado sin historial', () => {
        const achievements = computeAchievements(makeStats())
        expect(achievements.every((a) => !a.unlocked)).toBe(true)
        expect(achievements.length).toBeGreaterThanOrEqual(5)
    })

    it('"Primer talón" se desbloquea con un solo show, "Diez rituales" no', () => {
        const achievements = computeAchievements(makeStats({ showsAttended: 1 }))
        expect(achievements.find((a) => a.id === 'primer-talon')?.unlocked).toBe(true)
        expect(achievements.find((a) => a.id === 'diez-rituales')?.unlocked).toBe(false)
    })

    it('"Diez rituales" y "Veinticinco rituales" respetan su propio umbral', () => {
        const at10 = computeAchievements(makeStats({ showsAttended: 10 }))
        expect(at10.find((a) => a.id === 'diez-rituales')?.unlocked).toBe(true)
        expect(at10.find((a) => a.id === 'veinticinco-rituales')?.unlocked).toBe(false)

        const at25 = computeAchievements(makeStats({ showsAttended: 25 }))
        expect(at25.find((a) => a.id === 'veinticinco-rituales')?.unlocked).toBe(true)
    })

    it('"Explorador" mira uniqueVenues, no showsAttended', () => {
        const achievements = computeAchievements(makeStats({ showsAttended: 100, uniqueVenues: 1 }))
        expect(achievements.find((a) => a.id === 'explorador')?.unlocked).toBe(false)
    })

    it('"Multi-ciudad" y "Trotamundos" miran listas distintas', () => {
        const achievements = computeAchievements(
            makeStats({ uniqueCities: ['CABA', 'Rosario', 'Córdoba'], uniqueCountries: ['Argentina'] })
        )
        expect(achievements.find((a) => a.id === 'multi-ciudad')?.unlocked).toBe(true)
        expect(achievements.find((a) => a.id === 'trotamundos')?.unlocked).toBe(false)
    })

    it('"Fan fiel" mira el conteo del artista más visto, no la cantidad de artistas únicos', () => {
        const achievements = computeAchievements(
            makeStats({ uniqueArtists: 10, topArtists: [{ name: 'Bandalos Chinos', count: 3 }] })
        )
        expect(achievements.find((a) => a.id === 'fan-fiel')?.unlocked).toBe(true)
    })

    it('"Crítico" mira totalRated, no averageRating', () => {
        const achievements = computeAchievements(makeStats({ averageRating: 5, totalRated: 1 }))
        expect(achievements.find((a) => a.id === 'critico')?.unlocked).toBe(false)
    })

    it('ningún logro depende de rainyShows — ese campo siempre da 0 hoy y sería un logro imposible', () => {
        const achievements = computeAchievements(makeStats({ rainyShows: 999 }))
        expect(achievements.every((a) => !a.unlocked)).toBe(true)
    })
})
