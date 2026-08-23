import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./open-meteo', () => ({
    fetchHistoricalHourly: vi.fn(),
    fetchForecastHourly: vi.fn(),
}))

import { getEventWeather, describeWeatherCode } from './weather-service'
import { fetchHistoricalHourly, fetchForecastHourly } from './open-meteo'

const NOW = new Date('2026-08-22T15:00:00Z') // 2026-08-22 12:00 ART

describe('getEventWeather', () => {
    beforeEach(() => {
        vi.mocked(fetchHistoricalHourly).mockReset()
        vi.mocked(fetchForecastHourly).mockReset()
    })

    it('returns null when the venue has no coordinates — never crashes the event page', async () => {
        const result = await getEventWeather({ date: '2026-07-01T23:00:00Z' }, { lat: null, lng: null }, NOW)
        expect(result).toBeNull()
        expect(fetchHistoricalHourly).not.toHaveBeenCalled()
        expect(fetchForecastHourly).not.toHaveBeenCalled()
    })

    it('returns null when venue is missing entirely', async () => {
        const result = await getEventWeather({ date: '2026-07-01T23:00:00Z' }, null, NOW)
        expect(result).toBeNull()
    })

    it('returns null for an invalid event date instead of throwing', async () => {
        const result = await getEventWeather({ date: 'not-a-date' }, { lat: -34.5, lng: -58.4 }, NOW)
        expect(result).toBeNull()
    })

    it('calls the historical (archive) API for a past show, at the exact ART hour', async () => {
        // 2026-07-01T23:00:00Z = 2026-07-01 20:00 ART (same calendar day, -3h)
        vi.mocked(fetchHistoricalHourly).mockResolvedValue([
            { time: '2026-07-01T20:00', temperatureC: 14.2, precipitationMm: 0, weatherCode: 1 },
        ])

        const result = await getEventWeather({ date: '2026-07-01T23:00:00Z' }, { lat: -34.5447, lng: -58.4497 }, NOW)

        expect(fetchHistoricalHourly).toHaveBeenCalledWith(-34.5447, -58.4497, '2026-07-01', 'America/Argentina/Buenos_Aires')
        expect(fetchForecastHourly).not.toHaveBeenCalled()
        expect(result).toEqual({
            temperatureC: 14.2,
            precipitationMm: 0,
            weatherCode: 1,
            isRain: false,
            description: 'Mayormente despejado',
            hourLabel: '20:00',
        })
    })

    it('calls the forecast API for a near-future show', async () => {
        // 2026-08-25T23:00:00Z = 2026-08-25 20:00 ART, 3 days ahead of NOW (2026-08-22 ART)
        vi.mocked(fetchForecastHourly).mockResolvedValue([
            { time: '2026-08-25T20:00', temperatureC: 10.0, precipitationMm: 2.4, weatherCode: 63 },
        ])

        const result = await getEventWeather({ date: '2026-08-25T23:00:00Z' }, { lat: -34.5447, lng: -58.4497 }, NOW)

        expect(fetchForecastHourly).toHaveBeenCalledWith(-34.5447, -58.4497, 'America/Argentina/Buenos_Aires', 4)
        expect(fetchHistoricalHourly).not.toHaveBeenCalled()
        expect(result).toEqual({
            temperatureC: 10.0,
            precipitationMm: 2.4,
            weatherCode: 63,
            isRain: true,
            description: 'Lluvia',
            hourLabel: '20:00',
        })
    })

    it('returns null for a future show beyond the 16-day forecast horizon, without calling the API', async () => {
        const result = await getEventWeather({ date: '2026-12-25T23:00:00Z' }, { lat: -34.5447, lng: -58.4497 }, NOW)

        expect(result).toBeNull()
        expect(fetchForecastHourly).not.toHaveBeenCalled()
    })

    it('returns null when Open-Meteo has no data point for that exact hour', async () => {
        vi.mocked(fetchHistoricalHourly).mockResolvedValue([
            { time: '2026-07-01T21:00', temperatureC: 13.0, precipitationMm: 0, weatherCode: 0 },
        ])

        const result = await getEventWeather({ date: '2026-07-01T23:00:00Z' }, { lat: -34.5447, lng: -58.4497 }, NOW)

        expect(result).toBeNull()
    })

    it('returns null when the underlying HTTP client fails (network/timeout)', async () => {
        vi.mocked(fetchHistoricalHourly).mockResolvedValue(null)

        const result = await getEventWeather({ date: '2026-07-01T23:00:00Z' }, { lat: -34.5447, lng: -58.4497 }, NOW)

        expect(result).toBeNull()
    })

    it('marks rain by precipitation amount, not by weather code alone', async () => {
        vi.mocked(fetchHistoricalHourly).mockResolvedValue([
            { time: '2026-07-01T20:00', temperatureC: 14.2, precipitationMm: 0.4, weatherCode: 3 },
        ])

        const result = await getEventWeather({ date: '2026-07-01T23:00:00Z' }, { lat: -34.5447, lng: -58.4497 }, NOW)

        expect(result?.isRain).toBe(true)
    })
})

describe('describeWeatherCode', () => {
    it('maps known WMO codes to Spanish labels', () => {
        expect(describeWeatherCode(0)).toBe('Despejado')
        expect(describeWeatherCode(63)).toBe('Lluvia')
        expect(describeWeatherCode(95)).toBe('Tormenta eléctrica')
    })

    it('falls back to a generic label for unknown or missing codes', () => {
        expect(describeWeatherCode(12345)).toBe('Sin datos')
        expect(describeWeatherCode(null)).toBe('Sin datos')
    })
})
