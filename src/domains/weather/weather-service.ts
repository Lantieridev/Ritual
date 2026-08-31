/**
 * Orquesta el clima exacto de un show — issue #8: ubicación exacta (lat/lng
 * de la sede) a la hora exacta (events.date completo), no un resumen
 * genérico del día ni de "la ciudad en general".
 *
 * Reglas de negocio (documentadas acá porque no están en el cliente HTTP
 * puro de open-meteo.ts):
 *   - Sede sin lat/lng → sin clima. No todas las sedes cargadas antes de
 *     este feature tienen coordenadas; se degrada mostrando nada, nunca
 *     rompe la página del evento.
 *   - Show pasado → Historical Weather API (archive-api). Show futuro/hoy →
 *     Forecast API. Mismo split que pide el issue.
 *   - Pronóstico: Open-Meteo cubre 16 días de datos ARRANCANDO HOY (offset
 *     0..15) — el show más lejano con clima disponible es el de dentro de
 *     15 días, no 16 (ver MAX_FORECAST_DAYS). Un show más lejano que eso
 *     simplemente no tiene clima todavía (no es un error).
 *   - "Lluvia" se decide por precipitación horaria > 0mm, no por el
 *     weather_code — es una señal más directa y evita mantener una lista
 *     hardcodeada de códigos WMO "que cuentan como lluvia".
 *
 * Precisión de la hora: antes de este PR, el form manual no pedía hora
 * (ver EventForm) y la importación de Setlist.fm siempre guarda
 * "T00:00:00Z" como placeholder (Ticketmaster sí trae hora real cuando la
 * API la tiene). Esta función no intenta adivinar si la hora guardada es
 * "real" — usa el timestamp tal cual está, como pide el issue ("la
 * timestamp ya soporta hora, el form solo no la estaba pidiendo"). Para
 * shows cargados o editados desde este PR en adelante, la hora siempre es
 * real porque el form ahora la exige. Shows viejos no re-editados pueden
 * mostrar el clima de medianoche UTC (21:00 ART del día anterior) — una
 * limitación conocida, no un crash.
 */
import 'server-only'
import { APP_TIMEZONE, isPastEvent, daysUntil } from '@/src/core/lib/dates'
import { fetchHistoricalHourly, fetchForecastHourly, type HourlyWeatherPoint } from './open-meteo'

// Bug real, encontrado por revisión externa y confirmado contra la API real
// de Open-Meteo: `forecast_days=N` devuelve N días arrancando HOY (offset
// 0..N-1), y el máximo válido de N es 16 -así que el offset más lejano
// alcanzable es 15 días, no 16. Con el 16 viejo acá, un show a exactamente
// 16 días pasaba el guard de abajo y después pedía forecast_days=17, que
// Open-Meteo rechaza con "Forecast days is invalid" -clima nunca mostrado
// para ese show, sin ningún error visible para el usuario.
const MAX_FORECAST_DAYS = 15

export interface EventWeather {
    temperatureC: number
    precipitationMm: number
    weatherCode: number | null
    isRain: boolean
    description: string
    /** "HH:mm" — la hora (ART) para la que se calculó este clima. */
    hourLabel: string
}

const WEATHER_DESCRIPTIONS: Record<number, string> = {
    0: 'Despejado',
    1: 'Mayormente despejado',
    2: 'Parcialmente nublado',
    3: 'Nublado',
    45: 'Niebla',
    48: 'Niebla escarchada',
    51: 'Llovizna débil',
    53: 'Llovizna',
    55: 'Llovizna densa',
    56: 'Llovizna helada',
    57: 'Llovizna helada densa',
    61: 'Lluvia débil',
    63: 'Lluvia',
    65: 'Lluvia intensa',
    66: 'Lluvia helada',
    67: 'Lluvia helada intensa',
    71: 'Nevada débil',
    73: 'Nevada',
    75: 'Nevada intensa',
    77: 'Granizo fino',
    80: 'Chubascos débiles',
    81: 'Chubascos',
    82: 'Chubascos intensos',
    85: 'Chubascos de nieve débiles',
    86: 'Chubascos de nieve intensos',
    95: 'Tormenta eléctrica',
    96: 'Tormenta con granizo',
    99: 'Tormenta con granizo intenso',
}

/** Traduce un código WMO (https://open-meteo.com/en/docs, sección weather_code) a una etiqueta corta en español. */
export function describeWeatherCode(code: number | null): string {
    if (code === null) return 'Sin datos'
    return WEATHER_DESCRIPTIONS[code] ?? 'Sin datos'
}

/**
 * "YYYY-MM-DDTHH:00" de un instante, en `timezone` — mismo formato que usa
 * Open-Meteo para las claves de su array `hourly.time`. Redondea hacia
 * abajo a la hora (Open-Meteo solo tiene granularidad horaria).
 */
function toHourlyKey(date: Date, timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:00`
}

function pickPoint(points: HourlyWeatherPoint[], key: string): HourlyWeatherPoint | null {
    return points.find((p) => p.time === key) ?? null
}

export interface VenueCoords {
    lat?: number | null
    lng?: number | null
}

/**
 * Clima real del show: ubicación exacta de la sede, hora exacta del evento.
 * `null` cuando no hay suficiente información (sede sin coordenadas, fecha
 * inválida, show demasiado lejos en el futuro para tener pronóstico) o
 * cuando Open-Meteo no responde — nunca lanza.
 */
export async function getEventWeather(
    event: { date: string },
    venue: VenueCoords | null | undefined,
    reference: Date = new Date()
): Promise<EventWeather | null> {
    if (venue?.lat == null || venue?.lng == null) return null

    const eventDate = new Date(event.date)
    if (Number.isNaN(eventDate.getTime())) return null

    const hourKey = toHourlyKey(eventDate, APP_TIMEZONE)
    const dateOnly = hourKey.slice(0, 10)

    let points: HourlyWeatherPoint[] | null
    if (isPastEvent(event.date, reference)) {
        points = await fetchHistoricalHourly(venue.lat, venue.lng, dateOnly, APP_TIMEZONE)
    } else {
        const daysAhead = daysUntil(event.date, reference)
        if (daysAhead > MAX_FORECAST_DAYS) return null
        points = await fetchForecastHourly(venue.lat, venue.lng, APP_TIMEZONE, Math.max(daysAhead + 1, 1))
    }

    if (!points) return null
    const point = pickPoint(points, hourKey)
    if (!point || point.temperatureC === null) return null

    return {
        temperatureC: point.temperatureC,
        precipitationMm: point.precipitationMm ?? 0,
        weatherCode: point.weatherCode,
        isRain: (point.precipitationMm ?? 0) > 0,
        description: describeWeatherCode(point.weatherCode),
        hourLabel: hourKey.slice(11),
    }
}
