import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchHistoricalHourly, fetchForecastHourly } from './open-meteo'

function mockJsonResponse(status: number, body: unknown, ok = status < 400) {
    return {
        ok,
        status,
        json: () => Promise.resolve(body),
    } as Response
}

describe('fetchHistoricalHourly', () => {
    beforeEach(() => {
        global.fetch = vi.fn()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('builds the archive-api URL with lat/lng/dates/timezone and returns flattened hourly points', async () => {
        vi.mocked(global.fetch).mockResolvedValue(
            mockJsonResponse(200, {
                hourly: {
                    time: ['2024-05-01T00:00', '2024-05-01T01:00'],
                    temperature_2m: [16.7, 16.3],
                    precipitation: [0, 0.1],
                    weather_code: [3, 51],
                },
            })
        )

        const result = await fetchHistoricalHourly(-34.5447, -58.4497, '2024-05-01', 'America/Argentina/Buenos_Aires')

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('archive-api.open-meteo.com/v1/archive'),
            expect.anything()
        )
        const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as string
        expect(calledUrl).toContain('latitude=-34.5447')
        expect(calledUrl).toContain('longitude=-58.4497')
        expect(calledUrl).toContain('start_date=2024-05-01')
        expect(calledUrl).toContain('end_date=2024-05-01')
        expect(calledUrl).toContain('hourly=temperature_2m%2Cprecipitation%2Cweather_code')
        expect(calledUrl).toContain('timezone=America%2FArgentina%2FBuenos_Aires')

        expect(result).toEqual([
            { time: '2024-05-01T00:00', temperatureC: 16.7, precipitationMm: 0, weatherCode: 3 },
            { time: '2024-05-01T01:00', temperatureC: 16.3, precipitationMm: 0.1, weatherCode: 51 },
        ])
    })

    it('returns null without throwing when Open-Meteo responds with an error', async () => {
        vi.mocked(global.fetch).mockResolvedValue(
            mockJsonResponse(400, { error: true, reason: 'Latitude must be in range of -90 to 90°' }, false)
        )

        const result = await fetchHistoricalHourly(999, 999, '2024-05-01', 'America/Argentina/Buenos_Aires')

        expect(result).toBeNull()
    })

    it('returns null without throwing on a network failure', async () => {
        vi.mocked(global.fetch).mockRejectedValue(new Error('network down'))

        const result = await fetchHistoricalHourly(-34.5447, -58.4497, '2024-05-01', 'America/Argentina/Buenos_Aires')

        expect(result).toBeNull()
    })

    it('returns null when the response has no hourly block', async () => {
        vi.mocked(global.fetch).mockResolvedValue(mockJsonResponse(200, {}))

        const result = await fetchHistoricalHourly(-34.5447, -58.4497, '2024-05-01', 'America/Argentina/Buenos_Aires')

        expect(result).toBeNull()
    })
})

describe('fetchForecastHourly', () => {
    beforeEach(() => {
        global.fetch = vi.fn()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('builds the forecast API URL with forecast_days and returns flattened hourly points', async () => {
        vi.mocked(global.fetch).mockResolvedValue(
            mockJsonResponse(200, {
                hourly: {
                    time: ['2026-08-23T00:00'],
                    temperature_2m: [12.1],
                    precipitation: [0],
                    weather_code: [0],
                },
            })
        )

        const result = await fetchForecastHourly(-34.5447, -58.4497, 'America/Argentina/Buenos_Aires', 3)

        const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as string
        expect(calledUrl).toContain('api.open-meteo.com/v1/forecast')
        expect(calledUrl).toContain('forecast_days=3')
        expect(result).toEqual([{ time: '2026-08-23T00:00', temperatureC: 12.1, precipitationMm: 0, weatherCode: 0 }])
    })
})
