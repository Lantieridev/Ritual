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

const APP_TIMEZONE = 'America/Argentina/Buenos_Aires'

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
 */
function toDateOnly(isoString: string): string {
    if (BARE_DATE.test(isoString)) return isoString
    return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(new Date(isoString))
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
