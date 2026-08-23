import { describe, it, expect } from 'vitest'
import {
  isPastEvent,
  isUpcomingEvent,
  nearestUpcoming,
  todayDateOnly,
  eventYear,
  eventMonth,
  daysUntil,
  combineDateAndTime,
  eventTimeOfDay,
} from './dates'

// Regression tests for a timezone bug: a date-only string like "2026-07-21"
// parses as UTC midnight, which is 2026-07-20T21:00 in Argentina (UTC-3).
// Comparing that instant directly against `now` made a show happening
// "today" read as already past for the entire day — these tests pin the
// exact boundary that broke.

describe('isPastEvent', () => {
  it('does not mark a same-day (Argentina) show as past at midday', () => {
    // 2026-07-21T15:00:00Z = 2026-07-21 12:00 ART — solidly "today" locally.
    const now = new Date('2026-07-21T15:00:00Z')
    expect(isPastEvent('2026-07-21', now)).toBe(false)
  })

  it('does not mark a same-day show as past just after midnight in Argentina', () => {
    // 2026-07-21T03:30:00Z = 2026-07-21 00:30 ART — the tightest edge: the
    // old `new Date(dateStr) < now` comparison (UTC midnight vs this instant)
    // would wrongly say "past" here, since UTC midnight is earlier in
    // absolute time even though the Argentina calendar day just started.
    const now = new Date('2026-07-21T03:30:00Z')
    expect(isPastEvent('2026-07-21', now)).toBe(false)
  })

  it('still marks yesterday as past', () => {
    const now = new Date('2026-07-21T15:00:00Z')
    expect(isPastEvent('2026-07-20', now)).toBe(true)
  })

  it('does not mark tomorrow as past', () => {
    const now = new Date('2026-07-21T15:00:00Z')
    expect(isPastEvent('2026-07-22', now)).toBe(false)
  })

  it('handles full datetime strings (external imports) by calendar day, not exact instant', () => {
    const now = new Date('2026-07-21T15:00:00Z')
    expect(isPastEvent('2026-07-21T23:00:00Z', now)).toBe(false)
    expect(isPastEvent('2026-07-20T23:00:00Z', now)).toBe(true)
  })
})

describe('isUpcomingEvent', () => {
  it('is the exact inverse of isPastEvent, today counts as upcoming', () => {
    const now = new Date('2026-07-21T03:30:00Z')
    expect(isUpcomingEvent('2026-07-21', now)).toBe(true)
    expect(isUpcomingEvent('2026-07-20', now)).toBe(false)
  })
})

describe('todayDateOnly', () => {
  it('anchors to the Argentina calendar day, not the server/UTC day', () => {
    // 2026-07-21T01:00:00Z is still 2026-07-20 22:00 ART.
    expect(todayDateOnly(new Date('2026-07-21T01:00:00Z'))).toBe('2026-07-20')
    expect(todayDateOnly(new Date('2026-07-21T15:00:00Z'))).toBe('2026-07-21')
  })
})

// Grouping shows by year via `new Date(dateStr).getFullYear()` reads the
// SERVER's local time (UTC in most deployments), not Argentina's — a show
// right after midnight UTC on Jan 1st is still Dec 31st in Buenos Aires.
describe('eventYear', () => {
  it('reads the year from an Argentina-anchored calendar day, not the server/UTC day', () => {
    expect(eventYear('2026-01-01T01:00:00Z')).toBe(2025)
    expect(eventYear('2026-01-01T15:00:00Z')).toBe(2026)
  })

  it('reads the year straight from a date-only string', () => {
    expect(eventYear('2025-12-31')).toBe(2025)
  })
})

// Same root cause as eventYear: a raw `new Date(dateStr).getMonth()` reads
// the SERVER's local timezone, not Argentina's — a bare "YYYY-MM-DD" string
// parses as UTC midnight, which rolls back to the previous month in any
// timezone behind UTC.
describe('eventMonth', () => {
  it('reads the month straight from a date-only string, 0-indexed like Date#getMonth', () => {
    expect(eventMonth('2026-03-01')).toBe(2)
    expect(eventMonth('2026-01-01')).toBe(0)
    expect(eventMonth('2026-12-31')).toBe(11)
  })

  it('reads the month from an Argentina-anchored calendar day, not the server/UTC day', () => {
    expect(eventMonth('2026-03-01T01:00:00Z')).toBe(1) // 22:00 del 28/02 en Argentina (UTC-3)
    expect(eventMonth('2026-03-01T15:00:00Z')).toBe(2)
  })
})

// The homepage's "próximo show" used to call .find() over a descending-sorted
// array and return the FARTHEST future match instead of the nearest one
// whenever 2+ shows were marked "Voy".

describe('daysUntil', () => {
  const now = new Date('2026-07-21T15:00:00Z') // 2026-07-21 12:00 ART

  it('is 0 for a show happening today', () => {
    expect(daysUntil('2026-07-21', now)).toBe(0)
  })

  it('counts whole calendar days to a future date', () => {
    expect(daysUntil('2026-07-24', now)).toBe(3)
  })

  it('is negative for a past date', () => {
    expect(daysUntil('2026-07-18', now)).toBe(-3)
  })

  it('anchors to the Argentina calendar day right after UTC midnight, not the server day', () => {
    // 2026-07-21T01:00:00Z is still 2026-07-20 22:00 ART.
    const justAfterUtcMidnight = new Date('2026-07-21T01:00:00Z')
    expect(daysUntil('2026-07-21', justAfterUtcMidnight)).toBe(1)
  })
})

describe('nearestUpcoming', () => {
  const now = new Date('2026-07-21T15:00:00Z')

  it('picks the closest future date, not the first element of a descending array', () => {
    // Deliberately sorted descending, like getEventsWithAttendance()'s query.
    const shows = [
      { id: 'far', date: '2026-12-01' },
      { id: 'near', date: '2026-08-01' },
      { id: 'nearest', date: '2026-07-25' },
    ]
    const result = nearestUpcoming(shows, (s) => s.date, now)
    expect(result?.id).toBe('nearest')
  })

  it('ignores past dates entirely', () => {
    const shows = [
      { id: 'past', date: '2026-01-01' },
      { id: 'upcoming', date: '2026-08-01' },
    ]
    const result = nearestUpcoming(shows, (s) => s.date, now)
    expect(result?.id).toBe('upcoming')
  })

  it('treats today as a valid candidate', () => {
    const shows = [
      { id: 'today', date: '2026-07-21' },
      { id: 'later', date: '2026-08-01' },
    ]
    const result = nearestUpcoming(shows, (s) => s.date, now)
    expect(result?.id).toBe('today')
  })

  it('returns undefined when nothing is upcoming', () => {
    const shows = [{ id: 'past', date: '2026-01-01' }]
    expect(nearestUpcoming(shows, (s) => s.date, now)).toBeUndefined()
  })
})

// Prerequisito técnico del issue #8 (clima exacto por hora): el form manual
// solo tenía selector de fecha. Estas dos funciones combinan/extraen la hora
// del mismo timestamptz sin agregar una columna nueva.
describe('combineDateAndTime', () => {
  it('builds a full ISO timestamp anchored to the fixed Argentina offset', () => {
    expect(combineDateAndTime('2026-07-21', '21:00')).toBe('2026-07-21T21:00:00-03:00')
  })

  it('preserves single-digit-looking HTML time input values as given (HH:mm)', () => {
    expect(combineDateAndTime('2026-01-01', '00:05')).toBe('2026-01-01T00:05:00-03:00')
  })
})

describe('eventTimeOfDay', () => {
  it('reads the Argentina local HH:mm from a UTC timestamp', () => {
    // 2026-07-21T23:30:00Z = 2026-07-21 20:30 ART (UTC-3)
    expect(eventTimeOfDay('2026-07-21T23:30:00Z')).toBe('20:30')
  })

  it('handles the midnight-ART edge without rolling over to "24:00"', () => {
    // 2026-07-21T03:00:00Z = 2026-07-21 00:00 ART exactly
    expect(eventTimeOfDay('2026-07-21T03:00:00Z')).toBe('00:00')
  })

  it('round-trips with combineDateAndTime', () => {
    const iso = combineDateAndTime('2026-07-21', '21:15')
    expect(eventTimeOfDay(iso)).toBe('21:15')
  })
})
