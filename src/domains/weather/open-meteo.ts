/**
 * Cliente para la API de Open-Meteo (https://open-meteo.com/) — ver issue #8.
 *
 * Elegida contra Weatherbit, Visual Crossing, WeatherStack y OpenWeather:
 * gratis, sin API key, datos horarios desde 1940, consulta directa por
 * coordenadas. Endpoints y parámetros verificados a mano contra la API real
 * (no solo la doc) antes de escribir este cliente:
 *
 *   - Historical Weather API (archive-api.open-meteo.com/v1/archive):
 *     GET ?latitude&longitude&start_date&end_date&hourly=...&timezone
 *     → 200 con datos horarios reales para una sede y fecha de Buenos Aires.
 *   - Forecast API (api.open-meteo.com/v1/forecast):
 *     GET ?latitude&longitude&hourly=...&timezone&forecast_days
 *     → 200 con pronóstico horario; `forecast_days` acepta 0-16 (17 devuelve
 *       400 "Forecast days is invalid. Allowed range 0 to 16").
 *
 * Solo se usa en servidor — sin necesidad de ocultar ninguna key (no hay),
 * pero mantiene el mismo patrón que ticketmaster.ts/setlistfm.ts.
 */
import 'server-only'
import { fetchWithRetry, isTimeoutError } from '@/src/core/lib/http'

const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast'
const ARCHIVE_BASE = 'https://archive-api.open-meteo.com/v1/archive'

// weather_code es el nombre de parámetro vigente en la API real — el alias
// legado "weathercode" (sin guion bajo) sigue funcionando pero está
// deprecado en la doc de Open-Meteo.
const HOURLY_PARAMS = 'temperature_2m,precipitation,weather_code'

/** Un punto horario de la respuesta `hourly` de Open-Meteo, ya aplanado. */
export interface HourlyWeatherPoint {
    /** "YYYY-MM-DDTHH:mm" en la timezone pedida — mismo formato que devuelve la API. */
    time: string
    temperatureC: number | null
    precipitationMm: number | null
    weatherCode: number | null
}

interface OpenMeteoHourlyResponse {
    hourly?: {
        time: string[]
        temperature_2m: Array<number | null>
        precipitation: Array<number | null>
        weather_code: Array<number | null>
    }
    error?: boolean
    reason?: string
}

async function fetchHourly(url: string): Promise<HourlyWeatherPoint[] | null> {
    try {
        const res = await fetchWithRetry(url, {}, { timeoutMs: 8000 })
        if (!res.ok) {
            const body = (await res.json().catch(() => null)) as OpenMeteoHourlyResponse | null
            console.error('Open-Meteo respondió con error', res.status, body?.reason ?? '')
            return null
        }
        const data = (await res.json()) as OpenMeteoHourlyResponse
        if (!data.hourly) return null

        const { time, temperature_2m, precipitation, weather_code } = data.hourly
        return time.map((t, i) => ({
            time: t,
            temperatureC: temperature_2m?.[i] ?? null,
            precipitationMm: precipitation?.[i] ?? null,
            weatherCode: weather_code?.[i] ?? null,
        }))
    } catch (e) {
        if (isTimeoutError(e)) {
            console.error('Open-Meteo tardó demasiado en responder.')
        } else {
            console.error('Error consultando Open-Meteo:', e)
        }
        return null
    }
}

/**
 * Clima histórico horario real para una fecha exacta (shows pasados).
 * `dateOnly` es "YYYY-MM-DD". Cubre desde 1940 hasta ~5 días antes de hoy
 * (latencia del dataset ERA5 que usa Open-Meteo por detrás).
 */
export async function fetchHistoricalHourly(
    lat: number,
    lng: number,
    dateOnly: string,
    timezone: string
): Promise<HourlyWeatherPoint[] | null> {
    const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lng),
        start_date: dateOnly,
        end_date: dateOnly,
        hourly: HOURLY_PARAMS,
        timezone,
    })
    return fetchHourly(`${ARCHIVE_BASE}?${params}`)
}

/**
 * Pronóstico horario (shows futuros cercanos). `forecastDays` es la
 * cantidad de días a pedir contando desde hoy inclusive — la API solo
 * acepta 0-16.
 */
export async function fetchForecastHourly(
    lat: number,
    lng: number,
    timezone: string,
    forecastDays: number
): Promise<HourlyWeatherPoint[] | null> {
    const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lng),
        hourly: HOURLY_PARAMS,
        timezone,
        forecast_days: String(forecastDays),
    })
    return fetchHourly(`${FORECAST_BASE}?${params}`)
}
