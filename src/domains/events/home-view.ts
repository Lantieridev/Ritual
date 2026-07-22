import { isPastEvent, eventYear } from '@/src/core/lib/dates'
import { nearestUpcoming } from '@/src/core/lib/dates'
import type { EventWithAttendance } from '@/src/domains/events/data'

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
 * fetch y del JSX para que sea testeable sin renderizar la página (R2-001,
 * "Fase 3 — Estructura y legibilidad").
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
