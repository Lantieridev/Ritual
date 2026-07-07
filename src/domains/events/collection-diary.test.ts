import { describe, it, expect } from 'vitest'
import {
  buildCollectionDiary,
  diaryHeadline,
  coleccionHref,
  parseCollectionView,
} from '@/src/domains/events/collection-diary'
import type { EventWithAttendance } from '@/src/domains/events/service'
import { routes } from '@/src/core/lib/routes'

// 2026-06-15 12:00 hora local — punto de referencia fijo para "ahora" (mismo
// patrón que home-view.test.ts).
const NOW = new Date(2026, 5, 15, 12, 0, 0)

function makeEvent(overrides: Partial<EventWithAttendance> & { id: string; date: string }): EventWithAttendance {
  return {
    name: null,
    venue_id: null,
    venues: null,
    lineups: null,
    attendance: [],
    ...overrides,
  } as EventWithAttendance
}

function att(rating: number | null = null): NonNullable<EventWithAttendance['attendance']>[number] {
  return { id: 'att1', status: 'went', user_id: 'u1', rating, review: null }
}

describe('buildCollectionDiary', () => {
  it('keeps only a past "went" event when past and future "went" events are mixed', () => {
    const events = [
      makeEvent({ id: 'past', date: '2026-01-01', attendance: [att()] }),
      makeEvent({ id: 'future', date: '2026-12-01', attendance: [att()] }),
    ]

    const rows = buildCollectionDiary(events, NOW)

    expect(rows.map((r) => r.id)).toEqual(['past'])
  })

  it('excludes events with a non-"went" status or no attendance record', () => {
    const events = [
      makeEvent({ id: 'wanted', date: '2026-01-01', attendance: [{ id: 'a', status: 'want', user_id: 'u1', rating: null, review: null }] }),
      makeEvent({ id: 'no-attendance', date: '2026-01-01', attendance: [] }),
    ]

    const rows = buildCollectionDiary(events, NOW)

    expect(rows).toEqual([])
  })

  it('sorts rows by date descending, most recent first', () => {
    const events = [
      makeEvent({ id: 'oldest', date: '2020-03-01', attendance: [att()] }),
      makeEvent({ id: 'newest', date: '2025-11-01', attendance: [att()] }),
      makeEvent({ id: 'middle', date: '2022-06-01', attendance: [att()] }),
    ]

    const rows = buildCollectionDiary(events, NOW)

    expect(rows.map((r) => r.id)).toEqual(['newest', 'middle', 'oldest'])
  })

  it('builds href from routes.events.detail', () => {
    const events = [makeEvent({ id: 'ev1', date: '2026-01-01', attendance: [att()] })]

    const rows = buildCollectionDiary(events, NOW)

    expect(rows[0].href).toBe(routes.events.detail('ev1'))
  })

  it('returns [] for []', () => {
    expect(buildCollectionDiary([], NOW)).toEqual([])
  })

  it('uses the lineup headliner name when a lineup artist exists', () => {
    const events = [
      makeEvent({
        id: 'ev1',
        date: '2026-01-01',
        name: 'Fallback event name',
        lineups: [{ artists: { id: 'a1', name: 'Divididos', genre: null } }],
        attendance: [att()],
      }),
    ]

    const rows = buildCollectionDiary(events, NOW)

    expect(rows[0].name).toBe('Divididos')
  })

  it('falls back to the event name when there is no lineup artist', () => {
    const events = [
      makeEvent({ id: 'ev1', date: '2026-01-01', name: 'Show sin lineup', lineups: null, attendance: [att()] }),
    ]

    const rows = buildCollectionDiary(events, NOW)

    expect(rows[0].name).toBe('Show sin lineup')
  })

  it('falls back to "Recital" when there is neither a lineup artist nor an event name', () => {
    const events = [
      makeEvent({ id: 'ev1', date: '2026-01-01', name: null, lineups: null, attendance: [att()] }),
    ]

    const rows = buildCollectionDiary(events, NOW)

    expect(rows[0].name).toBe('Recital')
  })

  it('passes the stored rating through as-is', () => {
    const events = [makeEvent({ id: 'ev1', date: '2026-01-01', attendance: [att(4)] })]

    const rows = buildCollectionDiary(events, NOW)

    expect(rows[0].rating).toBe(4)
  })

  it('keeps rating as null when the show was never scored', () => {
    const events = [makeEvent({ id: 'ev1', date: '2026-01-01', attendance: [att(null)] })]

    const rows = buildCollectionDiary(events, NOW)

    expect(rows[0].rating).toBeNull()
  })

  it('sets venue to null when the event has no venue', () => {
    const events = [makeEvent({ id: 'ev1', date: '2026-01-01', venues: null, attendance: [att()] })]

    const rows = buildCollectionDiary(events, NOW)

    expect(rows[0].venue).toBeNull()
  })

  it('reads venue.name when the event has a venue', () => {
    const events = [
      makeEvent({
        id: 'ev1',
        date: '2026-01-01',
        venues: { name: 'Niceto Club', city: null, country: null, lat: null, lng: null },
        attendance: [att()],
      }),
    ]

    const rows = buildCollectionDiary(events, NOW)

    expect(rows[0].venue).toBe('Niceto Club')
  })

  it('derives year in the app timezone via eventYear, not just the raw date string', () => {
    const events = [makeEvent({ id: 'ev1', date: '2025-12-31T23:30:00-03:00', attendance: [att()] })]

    const rows = buildCollectionDiary(events, NOW)

    expect(rows[0].year).toBe(2025)
  })
})

describe('diaryHeadline', () => {
  it('returns "{N} shows · {minYear} → hoy" for multiple rows spanning several years', () => {
    const rows = [
      { id: '1', name: 'A', venue: null, year: 2024, rating: null, href: '/events/1' },
      { id: '2', name: 'B', venue: null, year: 2011, rating: null, href: '/events/2' },
      { id: '3', name: 'C', venue: null, year: 2020, rating: null, href: '/events/3' },
    ]

    expect(diaryHeadline(rows)).toBe('3 shows · 2011 → hoy')
  })

  it('uses the singular "show" for exactly one row', () => {
    const rows = [{ id: '1', name: 'A', venue: null, year: 2011, rating: null, href: '/events/1' }]

    expect(diaryHeadline(rows)).toBe('1 show · 2011 → hoy')
  })

  it('returns null for an empty array', () => {
    expect(diaryHeadline([])).toBeNull()
  })

  it('finds the earliest year from the oldest row, not the array head', () => {
    // Rows sorted by date descending (most recent first) — the array head is
    // the newest row, not necessarily the oldest year.
    const rows = [
      { id: 'newest', name: 'A', venue: null, year: 2026, rating: null, href: '/events/1' },
      { id: 'oldest', name: 'B', venue: null, year: 2011, rating: null, href: '/events/2' },
    ]

    expect(diaryHeadline(rows)).toBe('2 shows · 2011 → hoy')
  })
})

describe('parseCollectionView', () => {
  it('returns "lista" only for the exact literal "lista"', () => {
    expect(parseCollectionView('lista')).toBe('lista')
  })

  it.each([undefined, '', 'grilla', 'LISTA', '../x', ['lista']])(
    'falls back to "grilla" for %j',
    (raw) => {
      expect(parseCollectionView(raw as string | string[] | undefined)).toBe('grilla')
    }
  )
})

describe('coleccionHref', () => {
  it('omits the param for "grilla" (canonical URL)', () => {
    expect(coleccionHref('grilla')).toBe(routes.collection)
  })

  it('appends ?vista=lista for "lista"', () => {
    expect(coleccionHref('lista')).toBe('/coleccion?vista=lista')
  })
})
