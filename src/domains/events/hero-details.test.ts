import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/venues/service', () => ({
    getVenueLocation: vi.fn(),
}))

vi.mock('@/src/domains/weather/weather-service', () => ({
    getEventWeatherCached: vi.fn(),
}))

import { getHeroVenueDetails, NO_VENUE_DETAILS } from './hero-details'
import { getVenueLocation } from '@/src/domains/venues/service'
import { getEventWeatherCached } from '@/src/domains/weather/weather-service'

/**
 * Dirección y clima del show que protagoniza el hero de Hoy mobile (issue
 * #82/#8) — nunca rechaza, y sólo pide clima cuando la sede tiene
 * coordenadas (ver Requirement "Address/Weather Degradation" en el spec).
 */
describe('getHeroVenueDetails', () => {
    beforeEach(() => {
        vi.mocked(getVenueLocation).mockReset()
        vi.mocked(getEventWeatherCached).mockReset()
    })

    it('sin venue_id no busca la sede ni pide clima', async () => {
        const result = await getHeroVenueDetails({ date: '2026-09-12T21:00:00-03:00', venue_id: null })

        expect(getVenueLocation).not.toHaveBeenCalled()
        expect(getEventWeatherCached).not.toHaveBeenCalled()
        expect(result).toEqual(NO_VENUE_DETAILS)
    })

    it('sede sin coordenadas no pide clima, pero sí devuelve la dirección', async () => {
        vi.mocked(getVenueLocation).mockResolvedValue({ address: 'Humboldt 450', lat: null, lng: null })

        const result = await getHeroVenueDetails({ date: '2026-09-12T21:00:00-03:00', venue_id: 'v1' })

        expect(getEventWeatherCached).not.toHaveBeenCalled()
        expect(result).toEqual({ address: 'Humboldt 450', weather: null })
    })

    it('con coordenadas pide el clima memoizado y lo combina con la dirección', async () => {
        vi.mocked(getVenueLocation).mockResolvedValue({ address: 'Humboldt 450', lat: -34.58, lng: -58.43 })
        vi.mocked(getEventWeatherCached).mockResolvedValue({
            temperatureC: 18,
            precipitationMm: 0,
            weatherCode: 0,
            isRain: false,
            description: 'Despejado',
            hourLabel: '21:00',
        })

        const result = await getHeroVenueDetails({ date: '2026-09-12T21:00:00-03:00', venue_id: 'v1' })

        expect(getEventWeatherCached).toHaveBeenCalledWith('2026-09-12T21:00:00-03:00', -34.58, -58.43)
        expect(result).toEqual({
            address: 'Humboldt 450',
            weather: expect.objectContaining({ temperatureC: 18 }),
        })
    })

    it('sede no encontrada degrada a sin datos, sin tirar', async () => {
        vi.mocked(getVenueLocation).mockResolvedValue(null)

        const result = await getHeroVenueDetails({ date: '2026-09-12T21:00:00-03:00', venue_id: 'v-missing' })

        expect(result).toEqual(NO_VENUE_DETAILS)
    })

    it('nunca rechaza: un error al buscar la sede degrada a sin datos', async () => {
        vi.mocked(getVenueLocation).mockRejectedValue(new Error('db down'))

        await expect(
            getHeroVenueDetails({ date: '2026-09-12T21:00:00-03:00', venue_id: 'v1' })
        ).resolves.toEqual(NO_VENUE_DETAILS)
    })

    it('nunca rechaza: un error al pedir el clima degrada a sin dirección ni clima', async () => {
        vi.mocked(getVenueLocation).mockResolvedValue({ address: 'Humboldt 450', lat: -34.58, lng: -58.43 })
        vi.mocked(getEventWeatherCached).mockRejectedValue(new Error('open-meteo down'))

        await expect(
            getHeroVenueDetails({ date: '2026-09-12T21:00:00-03:00', venue_id: 'v1' })
        ).resolves.toEqual(NO_VENUE_DETAILS)
    })
})
