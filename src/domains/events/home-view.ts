import { isPastEvent, eventYear, daysUntil, toDateOnly, todayDateOnly } from '@/src/core/lib/dates'
import { nearestUpcoming } from '@/src/core/lib/dates'
import type { EventWithAttendance, EventWithRelations } from '@/src/domains/events/service'

export type HomeFilter = 'all' | 'upcoming' | 'past' | 'interested' | 'going' | 'went'

export interface HomeFeed {
    nextShow: EventWithAttendance | undefined
    events: EventWithAttendance[]
    byYear: Record<string, EventWithAttendance[]>
    years: string[]
}

/**
 * Toda la lógica de agregación que antes vivía inline en app/page.tsx
 * (próximo show, filtro por status, agrupamiento por año) — separada del
 * fetch y del JSX para que sea testeable sin renderizar la página.
 */
export function buildHomeFeed(
    allEvents: EventWithAttendance[],
    filter: HomeFilter,
    now: Date = new Date()
): HomeFeed {
    // Próximo show con status 'going' — el más cercano, no el primero que
    // aparezca en el array (que está ordenado descendente por fecha).
    const nextShow = nearestUpcoming(
        allEvents.filter((ev) => ev.attendance?.[0]?.status === 'going'),
        (ev) => ev.date,
        now
    )

    const events = allEvents.filter((ev) => {
        const isPast = isPastEvent(ev.date, now)
        const status = ev.attendance?.[0]?.status

        switch (filter) {
            case 'upcoming': return !isPast
            case 'past': return isPast
            case 'interested': return !isPast && status === 'interested'
            case 'going': return !isPast && status === 'going'
            case 'went': return status === 'went'
            default: return true
        }
    })

    const byYear = events.reduce<Record<string, EventWithAttendance[]>>((acc, ev) => {
        const year = eventYear(ev.date).toString()
        if (!acc[year]) acc[year] = []
        acc[year].push(ev)
        return acc
    }, {})

    const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a))

    return { nextShow, events, byYear, years }
}

/**
 * Narrow shape of a festival for hero-state purposes — deliberately not the
 * full `Festival` type from the festivals domain, so this file doesn't take
 * a hard dependency on that domain's shape for what's really just "is one
 * running right now, and is the user going".
 */
export interface FestivalForHero {
    id: string
    name: string
    start_date: string
    end_date: string | null
    festival_attendance: Array<{ status: string }>
}

export type HomeHeroState =
    | { kind: 'festival'; festival: FestivalForHero }
    | { kind: 'show-today'; event: EventWithAttendance }
    | { kind: 'morning-after'; event: EventWithAttendance }
    | { kind: 'normal'; nextShow: EventWithAttendance; daysUntil: number }
    | { kind: 'past-only'; event: EventWithAttendance; yearsAgo: number | null }
    | { kind: 'first-time' }
    | { kind: 'guest'; event: EventWithRelations | undefined }

export interface HomeHeroContext {
    /** Every show of the current user, with their attendance. */
    myEvents?: EventWithAttendance[]
    /** false for a visitor without a session. */
    signedIn?: boolean
    /** Upcoming catalog shows — only used for the visitor without a session. */
    catalogUpcoming?: EventWithRelations[]
}

/**
 * Which Home hero state applies, in priority order:
 * - guest: nobody is signed in, so none of the personal states can apply.
 * - festival: one the user is attending is running right now.
 * - show-today: the next "going" show is today.
 * - morning-after: last night's show still has no rating. It beats the
 *   countdown because the review gets written the morning after or never.
 * - normal: countdown to the next "going" show.
 * - past-only: an archive but nothing scheduled — leads with the anniversary
 *   of a past show instead of recommendations, so Home stays a diary.
 * - first-time: nothing loaded at all.
 */
export function buildHomeHeroState(
    nextShow: EventWithAttendance | undefined,
    festivals: FestivalForHero[],
    now: Date = new Date(),
    { myEvents = [], signedIn = true, catalogUpcoming = [] }: HomeHeroContext = {}
): HomeHeroState {
    if (!signedIn) {
        return { kind: 'guest', event: nearestUpcoming(catalogUpcoming, (ev) => ev.date, now) }
    }

    const liveFestival = festivals.find((f) => {
        const attending = f.festival_attendance.some((a) => a.status === 'going' || a.status === 'interested')
        if (!attending) return false
        return daysUntil(f.start_date, now) <= 0 && daysUntil(f.end_date ?? f.start_date, now) >= 0
    })
    if (liveFestival) return { kind: 'festival', festival: liveFestival }

    if (nextShow && daysUntil(nextShow.date, now) === 0) {
        return { kind: 'show-today', event: nextShow }
    }

    const lastNight = myEvents.find((ev) => {
        const attendance = ev.attendance?.[0]
        if (!attendance || (attendance.status !== 'going' && attendance.status !== 'went')) return false
        return daysUntil(ev.date, now) === -1 && attendance.rating == null
    })
    if (lastNight) return { kind: 'morning-after', event: lastNight }

    if (nextShow) return { kind: 'normal', nextShow, daysUntil: daysUntil(nextShow.date, now) }

    // A "went" show dated in the future is inconsistent data, not an archive:
    // it must not lead Home as the last show seen.
    const archive = myEvents.filter(
        (ev) => ev.attendance?.[0]?.status === 'went' && daysUntil(ev.date, now) <= 0
    )
    if (archive.length > 0) return pickPastOnly(archive, now)

    return { kind: 'first-time' }
}

function isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * The show to lead with when there's an archive but nothing scheduled: one
 * seen on this same calendar day in an earlier year (the most recent, if
 * there are several), or else the most recently seen show. A show from
 * February 29 has its anniversary on February 28 in non-leap years.
 */
function pickPastOnly(archive: EventWithAttendance[], now: Date): HomeHeroState {
    const today = todayDateOnly(now)
    const currentYear = Number(today.slice(0, 4))
    const monthDay = today.slice(5)
    const matchesToday = (eventMonthDay: string) =>
        eventMonthDay === monthDay ||
        (eventMonthDay === '02-29' && monthDay === '02-28' && !isLeapYear(currentYear))

    let anniversary: EventWithAttendance | undefined
    for (const ev of archive) {
        const day = toDateOnly(ev.date)
        if (!matchesToday(day.slice(5)) || Number(day.slice(0, 4)) >= currentYear) continue
        if (!anniversary || day > toDateOnly(anniversary.date)) anniversary = ev
    }
    if (anniversary) {
        const yearsAgo = currentYear - Number(toDateOnly(anniversary.date).slice(0, 4))
        return { kind: 'past-only', event: anniversary, yearsAgo }
    }

    const mostRecent = archive.reduce((a, b) => (toDateOnly(b.date) > toDateOnly(a.date) ? b : a))
    return { kind: 'past-only', event: mostRecent, yearsAgo: null }
}

/** The event whose artist photo backs the hero, when the state has one. */
export function heroEventOf(state: HomeHeroState): EventWithRelations | undefined {
    switch (state.kind) {
        case 'show-today':
        case 'morning-after':
        case 'past-only':
        case 'guest':
            return state.event
        case 'normal':
            return state.nextShow
        default:
            return undefined
    }
}
