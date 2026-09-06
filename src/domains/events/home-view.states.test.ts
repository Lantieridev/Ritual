import { describe, it, expect } from 'vitest'
import { buildHomeHeroState, heroEventOf, type HomeHeroState } from '@/src/domains/events/home-view'
import type { EventWithAttendance, EventWithRelations } from '@/src/domains/events/service'

// 2026-06-15 12:00 local time — fixed reference point for "now".
const NOW = new Date(2026, 5, 15, 12, 0, 0)

function show(id: string, date: string, status?: string, rating: number | null = null): EventWithAttendance {
  return {
    id,
    date,
    name: null,
    venue_id: null,
    venues: null,
    lineups: null,
    attendance: status ? [{ id: `a-${id}`, status, user_id: 'u1', rating, review: null }] : [],
  } as unknown as EventWithAttendance
}

describe('buildHomeHeroState — visitor without a session', () => {
  it('is guest, led by the nearest upcoming catalog show', () => {
    const far = { id: 'far', date: '2026-08-01' } as EventWithRelations
    const near = { id: 'near', date: '2026-06-20' } as EventWithRelations

    const state = buildHomeHeroState(undefined, [], NOW, { signedIn: false, catalogUpcoming: [far, near] })

    expect(state).toEqual({ kind: 'guest', event: near })
  })

  it('is guest with no show when the catalog has nothing ahead', () => {
    const state = buildHomeHeroState(undefined, [], NOW, { signedIn: false, catalogUpcoming: [] })

    expect(state).toEqual({ kind: 'guest', event: undefined })
  })

  it('never falls into a personal state, even with a show today', () => {
    const tonight = show('t', '2026-06-15', 'going')

    expect(buildHomeHeroState(tonight, [], NOW, { signedIn: false }).kind).toBe('guest')
  })
})

describe('buildHomeHeroState — morning after', () => {
  it('picks last night\'s show while it still has no rating', () => {
    const lastNight = show('ln', '2026-06-14', 'went')

    const state = buildHomeHeroState(undefined, [], NOW, { myEvents: [lastNight] })

    expect(state).toEqual({ kind: 'morning-after', event: lastNight })
  })

  it('also applies when the show stayed as "going" and was never moved to "went"', () => {
    const lastNight = show('ln', '2026-06-14', 'going')

    expect(buildHomeHeroState(undefined, [], NOW, { myEvents: [lastNight] }).kind).toBe('morning-after')
  })

  it('does not apply once last night\'s show has a rating', () => {
    const rated = show('ln', '2026-06-14', 'went', 4)

    expect(buildHomeHeroState(undefined, [], NOW, { myEvents: [rated] }).kind).not.toBe('morning-after')
  })

  it('does not apply to a show the user was only interested in', () => {
    const interested = show('ln', '2026-06-14', 'interested')

    expect(buildHomeHeroState(undefined, [], NOW, { myEvents: [interested] }).kind).not.toBe('morning-after')
  })

  it('beats the countdown to the next show', () => {
    const lastNight = show('ln', '2026-06-14', 'went')
    const next = show('n', '2026-06-20', 'going')

    expect(buildHomeHeroState(next, [], NOW, { myEvents: [lastNight, next] }).kind).toBe('morning-after')
  })

  it('loses to a show happening today', () => {
    const lastNight = show('ln', '2026-06-14', 'went')
    const tonight = show('t', '2026-06-15', 'going')

    expect(buildHomeHeroState(tonight, [], NOW, { myEvents: [lastNight, tonight] }).kind).toBe('show-today')
  })
})

describe('buildHomeHeroState — past only', () => {
  it('leads with the anniversary: a show seen on this same day in an earlier year', () => {
    const anniversary = show('a', '2025-06-15', 'went', 5)
    const other = show('o', '2026-03-01', 'went')

    const state = buildHomeHeroState(undefined, [], NOW, { myEvents: [other, anniversary] })

    expect(state).toEqual({ kind: 'past-only', event: anniversary, yearsAgo: 1 })
  })

  it('picks the most recent anniversary when there are several', () => {
    const old = show('old', '2020-06-15', 'went')
    const recent = show('recent', '2023-06-15', 'went')

    const state = buildHomeHeroState(undefined, [], NOW, { myEvents: [old, recent] })

    expect(state).toEqual({ kind: 'past-only', event: recent, yearsAgo: 3 })
  })

  it('falls back to the most recently seen show when no anniversary matches', () => {
    const older = show('older', '2025-01-10', 'went')
    const latest = show('latest', '2026-05-02', 'went')

    const state = buildHomeHeroState(undefined, [], NOW, { myEvents: [older, latest] })

    expect(state).toEqual({ kind: 'past-only', event: latest, yearsAgo: null })
  })

  it('gives way to a scheduled show', () => {
    const past = show('p', '2025-06-15', 'went')
    const next = show('n', '2026-06-20', 'going')

    expect(buildHomeHeroState(next, [], NOW, { myEvents: [past, next] }).kind).toBe('normal')
  })
})

describe('buildHomeHeroState — first time', () => {
  it('is first-time when nothing is loaded', () => {
    expect(buildHomeHeroState(undefined, [], NOW, { myEvents: [] })).toEqual({ kind: 'first-time' })
  })

  it('does not count "interested" shows as an archive', () => {
    const interested = show('i', '2025-01-01', 'interested')

    expect(buildHomeHeroState(undefined, [], NOW, { myEvents: [interested] })).toEqual({ kind: 'first-time' })
  })
})

describe('heroEventOf', () => {
  const ev = show('e', '2026-06-20', 'going')

  it.each<[string, HomeHeroState]>([
    ['show-today', { kind: 'show-today', event: ev }],
    ['morning-after', { kind: 'morning-after', event: ev }],
    ['past-only', { kind: 'past-only', event: ev, yearsAgo: null }],
    ['guest', { kind: 'guest', event: ev }],
    ['normal', { kind: 'normal', nextShow: ev, daysUntil: 5 }],
  ])('returns the show behind the %s state', (_kind, state) => {
    expect(heroEventOf(state)).toBe(ev)
  })

  it('returns nothing for first-time and festival, which have no show photo', () => {
    expect(heroEventOf({ kind: 'first-time' })).toBeUndefined()
    expect(
      heroEventOf({
        kind: 'festival',
        festival: { id: 'f', name: 'F', start_date: '2026-06-15', end_date: null, festival_attendance: [] },
      })
    ).toBeUndefined()
  })
})
