/**
 * Centralized "is this show in the past?" logic.
 *
 * Root cause this exists to fix: event dates are captured via
 * `<input type="date">` (no time-of-day) and stored in a `timestamptz`
 * column. A bare "YYYY-MM-DD" string is parsed by JS/Postgres as UTC
 * midnight. Comparing that instant against `new Date()` in Argentina
 * (UTC-3) makes a show happening "today" read as already past for most
 * of the day, because UTC midnight of the 21st is 9pm local on the 20th.
 *
 * Fix: never compare exact instants for this decision. Compare calendar
 * days only, anchored to the app's timezone (Argentina) rather than
 * whatever timezone the server process happens to run in — Vercel's
 * server clock is UTC, not Buenos Aires, so `new Date().getDate()` on
 * the server is NOT "today in Argentina".
 */

/**
 * Exportado (no solo interno) porque el clima por hora (issue #8) también
 * necesita anclar sus consultas a Open-Meteo a esta misma timezone — una
 * sola fuente de verdad para "qué hora es, en términos del show" en vez de
 * un segundo string hardcodeado que puede divergir de este.
 */
export const APP_TIMEZONE = 'America/Argentina/Buenos_Aires'

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Extracts the YYYY-MM-DD calendar date an ISO date/datetime string falls
 * on, in the app's timezone.
 *
 * A bare "YYYY-MM-DD" string (from `<input type="date">`) has no time
 * component — its literal digits ARE the calendar date the user picked, and
 * must never be shifted by a timezone conversion (that shift is the root
 * cause this whole module exists to fix). A full datetime string carries a
 * real instant, so for that case we DO need to convert it to the app's
 * timezone to find which calendar day it actually falls on there.
 *
 * Exported (not just internal) because pre-filling a date input from a
 * stored `timestamptz` (e.g. EventForm's edit mode) has this exact same
 * problem — `event.date.slice(0, 10)` reads the UTC calendar date, not
 * Argentina's, and shows the wrong day for any show whose local time falls
 * before 21:00 UTC. Bare `date` columns (no time component, like
 * `expenses.date`) don't need this at all — see ExpenseForm, which slices
 * directly.
 */
export function toDateOnly(isoString: string): string {
    if (!isoString) return ''
    if (BARE_DATE.test(isoString)) return isoString
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(new Date(isoString))
    } catch {
        return ''
    }
}

/** Today's calendar date (YYYY-MM-DD) in the app's timezone, not the server's. */
export function todayDateOnly(reference: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(reference)
}

/**
 * The calendar year an event falls on, in the app's timezone — not
 * `new Date(dateStr).getFullYear()`, which reads the SERVER's local time
 * (UTC in most deployments) and can misfile a show close to a year
 * boundary into the wrong year for grouping (Wrapped, homepage, stats).
 */
export function eventYear(dateStr: string): number {
    return Number(toDateOnly(dateStr).slice(0, 4))
}

/**
 * The calendar month (0-11, same convention as `Date#getMonth`) an event
 * falls on, in the app's timezone — same reasoning as `eventYear`. Used for
 * "busiest month" in Wrapped; a raw `new Date(dateStr).getMonth()` can
 * misfile a show near a month boundary into the wrong month on a server
 * whose local timezone isn't Argentina.
 */
export function eventMonth(dateStr: string): number {
    return Number(toDateOnly(dateStr).slice(5, 7)) - 1
}

/**
 * Whether an event has already happened, compared by calendar day only.
 * A show happening today is never "past" — it only becomes past once
 * tomorrow starts (in Argentina time).
 */
export function isPastEvent(dateStr: string, reference: Date = new Date()): boolean {
    return toDateOnly(dateStr) < todayDateOnly(reference)
}

/** Inverse of isPastEvent — today counts as upcoming. */
export function isUpcomingEvent(dateStr: string, reference: Date = new Date()): boolean {
    return !isPastEvent(dateStr, reference)
}

function toUTCMidnight(dateOnly: string): number {
    const [y, m, d] = dateOnly.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
}

/**
 * Whole calendar days between now and dateStr, in the app's timezone.
 * 0 for today, negative for the past. Used for countdown displays.
 */
export function daysUntil(dateStr: string, reference: Date = new Date()): number {
    const targetMs = toUTCMidnight(toDateOnly(dateStr))
    const todayMs = toUTCMidnight(todayDateOnly(reference))
    return Math.round((targetMs - todayMs) / 86400000)
}

/**
 * Picks the nearest upcoming event date from a list, independent of the
 * list's own sort order (don't rely on .find() over a descending-sorted
 * array — that returns the farthest future match, not the nearest one).
 */
export function nearestUpcoming<T>(
    items: T[],
    getDate: (item: T) => string,
    reference: Date = new Date()
): T | undefined {
    let best: T | undefined
    let bestDate: string | null = null
    for (const item of items) {
        const d = getDate(item)
        if (isPastEvent(d, reference)) continue
        if (bestDate === null || toDateOnly(d) < bestDate) {
            best = item
            bestDate = toDateOnly(d)
        }
    }
    return best
}

/**
 * Combina el valor de un `<input type="date">` ("YYYY-MM-DD") y uno de
 * `<input type="time">` ("HH:mm") en un timestamp ISO completo, anclado a
 * la hora de Argentina — ver issue #8. Usa un offset fijo "-03:00" en vez
 * de convertir vía Intl porque Argentina no tiene horario de verano desde
 * 2009 (UTC-3 todo el año); un offset fijo es correcto y evita la
 * complejidad de calcular un offset variable para una timezone que no lo
 * necesita.
 */
export function combineDateAndTime(date: string, time: string): string {
    return `${date}T${time}:00-03:00`
}

/**
 * Hora local "HH:mm" (24hs, timezone de Argentina) de un timestamp
 * completo — usada para precargar el input de hora del formulario de
 * edición a partir del valor ya guardado en `events.date` (ver issue #8).
 */
export function eventTimeOfDay(dateStr: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(new Date(dateStr))
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '00'
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'
    return `${hour}:${minute}`
}

/**
 * Los adaptadores de fuentes externas emiten la fecha en el formato que usa
 * cada sitio, no en ISO: `enigma` y `quehacemos` mandan ISO, pero
 * `entradaweb` manda prosa ("Domingo 30 de Agosto, 2026 - 21:00hs.") y
 * `livepass` manda día + mes abreviado sin año ("13 SEP"). `new Date()` no
 * entiende ninguno de los dos últimos, así que el valor crudo terminaba
 * renderizado como el texto "Invalid Date" en la cartelera y rechazado por
 * Postgres al importar (`events.date` es `timestamptz not null`).
 */
const SPANISH_MONTHS: Record<string, number> = {
    ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
    jul: 6, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11,
}

function monthFromSpanish(name: string): number | null {
    const key = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .slice(0, 3)
    return key in SPANISH_MONTHS ? SPANISH_MONTHS[key] : null
}

/**
 * Interpreta la fecha cruda de un evento externo. Devuelve null cuando el
 * texto no representa una fecha reconocible — quien llama decide si mostrar
 * el crudo o descartar el evento, en vez de propagar un Date inválido.
 *
 * Sin año explícito se asume la próxima ocurrencia: un "13 SEP" listado en
 * diciembre es de septiembre del año siguiente, no de nueve meses atrás.
 */
export function parseExternalDateTime(raw: string | null | undefined, reference: Date = new Date()): Date | null {
    if (!raw) return null
    const text = raw.trim()
    if (!text) return null

    // Sólo se delega en el parser nativo cuando el texto ya es ISO 8601.
    // `new Date()` es deliberadamente permisivo y acepta cosas como "13 SEP"
    // devolviendo el año 2001, así que dejarlo interpretar formatos libres
    // produce fechas plausibles pero falsas en vez de un fallo visible.
    if (/^\d{4}-\d{2}-\d{2}([T ]|$)/.test(text)) {
        const iso = new Date(text)
        if (!Number.isNaN(iso.getTime())) return iso
    }

    const time = text.match(/(\d{1,2}):(\d{2})/)
    const hours = time ? Number(time[1]) : 0
    const minutes = time ? Number(time[2]) : 0

    // "30 de Agosto, 2026" / "Viernes 11 de Septiembre, 2026 - 21:00hs."
    const withYear = text.match(/(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)(?:\s*,?\s*(?:de\s+)?(\d{4}))?/)
    if (withYear) {
        const month = monthFromSpanish(withYear[2])
        if (month !== null) {
            const day = Number(withYear[1])
            const year = withYear[3] ? Number(withYear[3]) : inferYear(month, day, reference)
            return buildArgDate(year, month, day, hours, minutes)
        }
    }

    // "13 SEP" / "16 OCT" — día y mes abreviado, sin año.
    const dayMonth = text.match(/\b(\d{1,2})\s+([a-zA-ZáéíóúÁÉÍÓÚ]{3,10})\b/)
    if (dayMonth) {
        const month = monthFromSpanish(dayMonth[2])
        if (month !== null) {
            const day = Number(dayMonth[1])
            return buildArgDate(inferYear(month, day, reference), month, day, hours, minutes)
        }
    }

    return null
}

function pad2(n: number): string {
    return String(n).padStart(2, '0')
}

/**
 * Arma un Date a partir de componentes de calendario ANCLADOS a Argentina
 * (offset fijo -03:00, ver combineDateAndTime), no a la timezone del
 * servidor. `new Date(year, month, day, hours, minutes)` interpreta esos
 * componentes como hora LOCAL del proceso que corre el código — en Vercel
 * eso es UTC, no Buenos Aires, así que un show sin año explícito (o
 * cualquier fecha externa sin offset) terminaba corriéndose de fecha en
 * producción. Bug real: verificado forzando TZ=UTC localmente.
 */
function buildArgDate(year: number, month: number, day: number, hours: number, minutes: number): Date {
    const dateOnly = `${year}-${pad2(month + 1)}-${pad2(day)}`
    const timeOnly = `${pad2(hours)}:${pad2(minutes)}`
    return new Date(combineDateAndTime(dateOnly, timeOnly))
}

/**
 * Año de la próxima ocurrencia de ese día y mes, respecto de "hoy" en
 * Argentina (no en la timezone del servidor -mismo motivo que el resto de
 * este archivo). Compara strings de calendario ("YYYY-MM-DD"), no objetos
 * Date construidos con getters locales.
 */
function inferYear(month: number, day: number, reference: Date): number {
    const todayStr = todayDateOnly(reference)
    const year = Number(todayStr.slice(0, 4))
    const candidateStr = `${year}-${pad2(month + 1)}-${pad2(day)}`
    return candidateStr < todayStr ? year + 1 : year
}
