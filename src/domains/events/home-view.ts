import { isPastEvent, eventYear, daysUntil } from '@/src/core/lib/dates'
import { nearestUpcoming } from '@/src/core/lib/dates'
import type { EventWithAttendance } from '@/src/domains/events/service'

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
    | { kind: 'normal'; nextShow: EventWithAttendance | undefined; daysUntil: number | null }

/**
 * Which of the Home hero's three states applies, in priority order: a
 * festival the user is attending that's running right now beats a solo show
 * happening today, which beats the generic countdown-to-next-show view.
 */
export function buildHomeHeroState(
    nextShow: EventWithAttendance | undefined,
    festivals: FestivalForHero[],
    now: Date = new Date()
): HomeHeroState {
    const liveFestival = festivals.find((f) => {
        const attending = f.festival_attendance.some((a) => a.status === 'going' || a.status === 'interested')
        if (!attending) return false
        return daysUntil(f.start_date, now) <= 0 && daysUntil(f.end_date ?? f.start_date, now) >= 0
    })
    if (liveFestival) return { kind: 'festival', festival: liveFestival }

    if (nextShow && daysUntil(nextShow.date, now) === 0) {
        return { kind: 'show-today', event: nextShow }
    }

    return { kind: 'normal', nextShow, daysUntil: nextShow ? daysUntil(nextShow.date, now) : null }
}
