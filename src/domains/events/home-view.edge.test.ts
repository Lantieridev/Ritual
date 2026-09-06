import { describe, it, expect } from 'vitest'
import { buildHomeHeroState, heroEventOf, type FestivalForHero } from '@/src/domains/events/home-view'
import type { EventWithAttendance, EventWithRelations } from '@/src/domains/events/service'

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

function att(id: string, status: string, rating: number | null = null): NonNullable<EventWithAttendance['attendance']>[number] {
  return { id, status, user_id: 'u1', rating, review: null }
}

describe('Home View Edge Cases', () => {
  describe('Timezone Boundaries & ISO dates', () => {
    it('handles 00:30 Argentina time (UTC 03:30)', () => {
      // 2026-06-15 00:30 Argentina = 2026-06-15T03:30:00Z
      const now = new Date('2026-06-15T03:30:00Z')
      // A show on 2026-06-15 should be "today"
      const show = makeEvent({ id: 'e1', date: '2026-06-15', attendance: [att('a1', 'going')] })
      const state = buildHomeHeroState(show, [], now)
      expect(state.kind).toBe('show-today')
    })

    it('handles 23:30 Argentina time (UTC 02:30 next day)', () => {
      // 2026-06-15 23:30 Argentina = 2026-06-16T02:30:00Z
      const now = new Date('2026-06-16T02:30:00Z')
      // A show on 2026-06-15 should be "today"
      const show = makeEvent({ id: 'e1', date: '2026-06-15', attendance: [att('a1', 'going')] })
      const state = buildHomeHeroState(show, [], now)
      expect(state.kind).toBe('show-today')
    })

    it('handles ISO event dates in local offset correctly', () => {
      const now = new Date('2026-06-15T12:00:00-03:00')
      // Show is 23:30 local time on the 14th, which is 02:30 UTC on the 15th
      const lastNight = makeEvent({ id: 'e1', date: '2026-06-14T23:30:00-03:00', attendance: [att('a1', 'went')] })
      const state = buildHomeHeroState(undefined, [], now, { myEvents: [lastNight] })
      // Even though UTC date is 15th (same as today's UTC), local date is 14th, so it's yesterday
      expect(state.kind).toBe('morning-after')
    })
  })

  describe('Anniversaries & Dates', () => {
    it('a February 29 show has its anniversary on February 28 in non-leap years', () => {
      const now = new Date('2026-02-28T12:00:00-03:00')
      const archive = makeEvent({ id: 'e1', date: '2024-02-29', attendance: [att('a1', 'went', 5)] })

      const state = buildHomeHeroState(undefined, [], now, { myEvents: [archive] })

      expect(state).toMatchObject({ kind: 'past-only', yearsAgo: 2 })
    })

    it('does not also fire on March 1, so the anniversary shows exactly once', () => {
      const now = new Date('2026-03-01T12:00:00-03:00')
      const archive = makeEvent({ id: 'e1', date: '2024-02-29', attendance: [att('a1', 'went', 5)] })

      const state = buildHomeHeroState(undefined, [], now, { myEvents: [archive] })

      expect(state).toMatchObject({ kind: 'past-only', yearsAgo: null })
    })

    it('in a leap year a February 29 show only matches February 29', () => {
      const now = new Date('2028-02-28T12:00:00-03:00')
      const archive = makeEvent({ id: 'e1', date: '2024-02-29', attendance: [att('a1', 'went', 5)] })

      const state = buildHomeHeroState(undefined, [], now, { myEvents: [archive] })

      expect(state).toMatchObject({ kind: 'past-only', yearsAgo: null })
    })

    // There is no tiebreak rule on purpose: any unrated show from last night is
    // a valid thing to ask about, so the first one in the list is used.
    it('with several unrated shows last night, asks about one of them (the first in list order)', () => {
      const now = new Date('2026-06-15T12:00:00-03:00')
      const show1 = makeEvent({ id: 'e1', date: '2026-06-14', attendance: [att('a1', 'went')] })
      const show2 = makeEvent({ id: 'e2', date: '2026-06-14', attendance: [att('a2', 'went')] })
      
      const state = buildHomeHeroState(undefined, [], now, { myEvents: [show1, show2] })
      expect(state.kind).toBe('morning-after')
      if (state.kind === 'morning-after') {
        expect(state.event.id).toBe('e1')
      }
    })

    // Not a bug: a show marked "went" tonight is literally the last one seen,
    // and tomorrow it moves to morning-after on its own if it stays unrated.
    it('a show marked "went" today leads as the last one seen, not as an anniversary', () => {
      const now = new Date('2026-06-15T12:00:00-03:00')
      const todayWent = makeEvent({ id: 'e1', date: '2026-06-15', attendance: [att('a1', 'went')] })

      const state = buildHomeHeroState(undefined, [], now, { myEvents: [todayWent] })

      expect(state).toMatchObject({ kind: 'past-only', yearsAgo: null, event: { id: 'e1' } })
    })

    it('ignores "went" shows dated in the future (inconsistent data) instead of leading with them', () => {
      const now = new Date('2026-06-15T12:00:00-03:00')
      const futureWent = makeEvent({ id: 'e1', date: '2027-01-01', attendance: [att('a1', 'went')] })

      const state = buildHomeHeroState(undefined, [], now, { myEvents: [futureWent] })

      expect(state).toEqual({ kind: 'first-time' })
    })

    it('with a real archive next to inconsistent data, leads with the real past show', () => {
      const now = new Date('2026-06-15T12:00:00-03:00')
      const futureWent = makeEvent({ id: 'future', date: '2027-01-01', attendance: [att('a1', 'went')] })
      const realPast = makeEvent({ id: 'past', date: '2026-02-10', attendance: [att('a2', 'went')] })

      const state = buildHomeHeroState(undefined, [], now, { myEvents: [futureWent, realPast] })

      expect(state).toMatchObject({ kind: 'past-only', event: { id: 'past' } })
    })
  })

  describe('Data Edge Cases', () => {
    it('a show with an empty attendance array counts neither as last night nor as archive', () => {
      const now = new Date('2026-06-15T12:00:00-03:00')
      const yesterdayNoAttendance = makeEvent({ id: 'e1', date: '2026-06-14', attendance: [] })

      const state = buildHomeHeroState(undefined, [], now, { myEvents: [yesterdayNoAttendance] })

      expect(state).toEqual({ kind: 'first-time' })
    })

    it('treats rating 0 differently than null', () => {
      const now = new Date('2026-06-15T12:00:00-03:00')
      const unrated = makeEvent({ id: 'e1', date: '2026-06-14', attendance: [att('a1', 'went', null)] })
      const rated0 = makeEvent({ id: 'e2', date: '2026-06-14', attendance: [att('a2', 'went', 0)] })
      
      const stateUnrated = buildHomeHeroState(undefined, [], now, { myEvents: [unrated] })
      expect(stateUnrated.kind).toBe('morning-after')

      // Only a missing rating (null) means "not rated yet". A 0 is outside the
      // 1–5 scale, but it is still a stored rating, so it leaves morning-after.
      const stateRated0 = buildHomeHeroState(undefined, [], now, { myEvents: [rated0] })
      expect(stateRated0.kind).toBe('past-only')
    })
  })

  describe('Guest & Hierarchy', () => {
    it('filters out past events when guest uses catalogUpcoming', () => {
      const now = new Date('2026-06-15T12:00:00-03:00')
      const pastShow = { id: 'p1', date: '2026-06-10' } as EventWithRelations
      const futureShow = { id: 'f1', date: '2026-06-20' } as EventWithRelations
      
      const state = buildHomeHeroState(undefined, [], now, { signedIn: false, catalogUpcoming: [pastShow, futureShow] })
      expect(state.kind).toBe('guest')
      if (state.kind === 'guest') {
        expect(state.event?.id).toBe('f1')
      }
    })

    it('prioritizes a running festival over an unrated show from yesterday', () => {
      const now = new Date('2026-06-15T12:00:00-03:00')
      const festival: FestivalForHero = {
        id: 'f1',
        name: 'Fest',
        start_date: '2026-06-14',
        end_date: '2026-06-16',
        festival_attendance: [{ status: 'going' }]
      }
      const lastNight = makeEvent({ id: 'e1', date: '2026-06-14', attendance: [att('a1', 'went', null)] })
      
      const state = buildHomeHeroState(undefined, [festival], now, { myEvents: [lastNight] })
      expect(state.kind).toBe('festival')
    })
  })

  describe('heroEventOf', () => {
    it('returns the correct event for all states that have one', () => {
      const ev = makeEvent({ id: 'e1', date: '2026-06-15' })
      expect(heroEventOf({ kind: 'show-today', event: ev })?.id).toBe('e1')
      expect(heroEventOf({ kind: 'morning-after', event: ev })?.id).toBe('e1')
      expect(heroEventOf({ kind: 'past-only', event: ev, yearsAgo: null })?.id).toBe('e1')
      expect(heroEventOf({ kind: 'guest', event: ev })?.id).toBe('e1')
      expect(heroEventOf({ kind: 'normal', nextShow: ev, daysUntil: 5 })?.id).toBe('e1')
    })

    it('returns undefined for states without an event', () => {
      const fest = { id: 'f1', name: 'Fest', start_date: '2026-06-14', end_date: null, festival_attendance: [] }
      expect(heroEventOf({ kind: 'festival', festival: fest })).toBeUndefined()
      expect(heroEventOf({ kind: 'first-time' })).toBeUndefined()
      expect(heroEventOf({ kind: 'guest', event: undefined })).toBeUndefined()
    })
  })
})
