import { describe, it, expect } from 'vitest'
import { buildWrappedSummary } from '@/src/domains/stats/wrapped-view'
import type { StatsData } from '@/src/domains/stats/data'
import type { EventWithAttendance } from '@/src/domains/events/data'

function emptyLifetimeStats(showsByYear: Record<string, number> = {}): StatsData {
  return {
    totalShows: 0,
    showsAttended: 0,
    showsGoing: 0,
    showsInterested: 0,
    uniqueArtists: 0,
    uniqueVenues: 0,
    uniqueCities: [],
    uniqueCountries: [],
    showsByYear,
    topArtists: [],
    topVenues: [],
    averageRating: null,
    totalRated: 0,
    recentActivity: [],
  }
}

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

function att(id: string, status: string): NonNullable<EventWithAttendance['attendance']>[number] {
  return { id, status, user_id: 'u1', rating: null, review: null }
}

describe('buildWrappedSummary', () => {
  it('only counts "went" shows from the selected year, sorted ascending', () => {
    const events = [
      makeEvent({ id: 'went-2026-late', date: '2026-08-01', attendance: [att('a1', 'went')] }),
      makeEvent({ id: 'went-2026-early', date: '2026-02-01', attendance: [att('a2', 'went')] }),
      makeEvent({ id: 'going-2026', date: '2026-05-01', attendance: [att('a3', 'going')] }),
      makeEvent({ id: 'went-2025', date: '2025-05-01', attendance: [att('a4', 'went')] }),
    ]

    const summary = buildWrappedSummary(events, emptyLifetimeStats(), 2026)

    expect(summary.attendedThisYear.map((e) => e.id)).toEqual(['went-2026-early', 'went-2026-late'])
    expect(summary.hasData).toBe(true)
  })

  it('reports hasData=false and empty aggregates when nothing matches the year', () => {
    const summary = buildWrappedSummary([], emptyLifetimeStats(), 2026)

    expect(summary.hasData).toBe(false)
    expect(summary.attendedThisYear).toEqual([])
    expect(summary.avgRating).toBeNull()
    expect(summary.busiestMonth).toBeNull()
  })

  it('finds the busiest month among the year\'s attended shows', () => {
    const events = [
      makeEvent({ id: 'e1', date: '2026-03-01', attendance: [att('a1', 'went')] }),
      makeEvent({ id: 'e2', date: '2026-03-15', attendance: [att('a2', 'went')] }),
      makeEvent({ id: 'e3', date: '2026-07-01', attendance: [att('a3', 'went')] }),
    ]

    const summary = buildWrappedSummary(events, emptyLifetimeStats(), 2026)

    expect(summary.busiestMonth).toBe('marzo')
  })

  it('derives availableYears from the lifetime stats, not the current page of events', () => {
    const summary = buildWrappedSummary([], emptyLifetimeStats({ '2024': 2, '2026': 1 }), 2026)

    expect(summary.availableYears).toEqual([2026, 2024])
  })
})
