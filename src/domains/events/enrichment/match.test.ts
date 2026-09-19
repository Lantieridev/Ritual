import { describe, it, expect } from 'vitest'
import { findConfidentMatch, hasRealTime } from '@/src/domains/events/enrichment/match'
import type { FutureEvent } from '@/src/core/types'

function candidate(overrides: Partial<FutureEvent> = {}): FutureEvent {
  return {
    id: 'tm1',
    title: 'Bandalos Chinos',
    datetime: '2026-10-10T21:30:00-03:00',
    venue: { name: 'Niceto Club', city: 'Buenos Aires' },
    lineup: ['Bandalos Chinos'],
    ...overrides,
  }
}

const show = {
  date: '2026-10-10T00:00:00-03:00',
  venueName: 'Niceto Club',
  venueCity: 'Buenos Aires',
}

describe('findConfidentMatch', () => {
  it('returns the single candidate on the same local day in the same city', () => {
    const match = candidate()
    expect(findConfidentMatch(show, [match])).toBe(match)
  })

  it('returns null when there are no candidates', () => {
    expect(findConfidentMatch(show, [])).toBeNull()
  })

  it('returns null when two candidates qualify (ambiguous)', () => {
    expect(findConfidentMatch(show, [candidate({ id: 'a' }), candidate({ id: 'b' })])).toBeNull()
  })

  it('returns null when the local day differs', () => {
    expect(findConfidentMatch(show, [candidate({ datetime: '2026-10-11T21:30:00-03:00' })])).toBeNull()
  })

  it('compares the local day, not the UTC day', () => {
    // 22:00 ART on the 10th is already the 11th in UTC.
    const lateShow = candidate({ datetime: '2026-10-11T01:00:00Z' })
    expect(findConfidentMatch(show, [lateShow])).toBe(lateShow)
  })

  it('returns null when neither city nor venue match', () => {
    const other = candidate({ venue: { name: 'Luna Park', city: 'Córdoba' } })
    expect(findConfidentMatch(show, [other])).toBeNull()
  })

  it('matches on the venue name alone when the city differs or is missing', () => {
    const match = candidate({ venue: { name: 'Niceto Club', city: null } })
    expect(findConfidentMatch({ ...show, venueCity: null }, [match])).toBe(match)
  })

  it('matches when one venue name contains the other', () => {
    const match = candidate({ venue: { name: 'Niceto', city: null } })
    expect(findConfidentMatch({ ...show, venueCity: null }, [match])).toBe(match)
  })

  it('ignores accents and case when comparing', () => {
    const match = candidate({ venue: { name: 'ESTADIO ÚNICO', city: 'LA PLATA' } })
    const result = findConfidentMatch(
      { date: '2026-10-10T00:00:00-03:00', venueName: 'Estadio Unico', venueCity: 'la plata' },
      [match]
    )
    expect(result).toBe(match)
  })

  it('does not match on empty strings', () => {
    const blank = candidate({ venue: { name: '', city: '' } })
    expect(findConfidentMatch({ ...show, venueName: '', venueCity: '' }, [blank])).toBeNull()
  })

  it('skips candidates without a datetime', () => {
    expect(findConfidentMatch(show, [candidate({ datetime: '' })])).toBeNull()
  })
})

describe('hasRealTime', () => {
  it('is true for a real evening hour', () => {
    expect(hasRealTime(candidate({ datetime: '2026-10-10T21:30:00-03:00' }))).toBe(true)
  })

  it('is false for the local-midnight placeholder ticketmaster.ts fills when no hour is sent', () => {
    expect(hasRealTime(candidate({ datetime: '2026-10-10T00:00:00-03:00' }))).toBe(false)
  })

  it('is false when there is no datetime', () => {
    expect(hasRealTime(candidate({ datetime: '' }))).toBe(false)
  })
})
