import { describe, it, expect } from 'vitest'
import {
  buildHomeFeed,
  buildHomeHeroState,
  heroBadgeText,
  pickRecentSeen,
  RECENT_SEEN_LIMIT,
  weatherTag,
  resolveInitialOpen,
  type FestivalForHero,
} from '@/src/domains/events/home-view'
import type { EventWithAttendance } from '@/src/domains/events/data'
import type { EventWeather } from '@/src/domains/weather/weather-service'

// 2026-06-15 12:00 hora local — punto de referencia fijo para "ahora".
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

function att(id: string, status: string): NonNullable<EventWithAttendance['attendance']>[number] {
  return { id, status, user_id: 'u1', rating: null, review: null }
}

describe('buildHomeFeed', () => {
  it('picks the nearest upcoming "going" show, not the first in array order', () => {
    const events = [
      makeEvent({ id: 'far', date: '2026-12-01', attendance: [att('a1', 'going')] }),
      makeEvent({ id: 'near', date: '2026-06-20', attendance: [att('a2', 'going')] }),
    ]

    const { nextShow } = buildHomeFeed(events, 'all', NOW)

    expect(nextShow?.id).toBe('near')
  })

  it('ignores non-"going" attendance when picking the next show', () => {
    const events = [
      makeEvent({ id: 'interested', date: '2026-06-20', attendance: [att('a1', 'interested')] }),
    ]

    const { nextShow } = buildHomeFeed(events, 'all', NOW)

    expect(nextShow).toBeUndefined()
  })

  it.each([
    ['upcoming', ['future']],
    ['past', ['past', 'went-past']],
    ['went', ['went-past']],
  ] as const)('filter=%s keeps only the matching events', (filter, expectedIds) => {
    const events = [
      makeEvent({ id: 'future', date: '2026-07-01', attendance: [att('a1', 'interested')] }),
      makeEvent({ id: 'past', date: '2026-01-01', attendance: [att('a2', 'interested')] }),
      makeEvent({ id: 'went-past', date: '2026-01-01', attendance: [att('a3', 'went')] }),
    ]

    const { events: result } = buildHomeFeed(events, filter, NOW)

    expect(result.map((e) => e.id).sort()).toEqual([...expectedIds].sort())
  })

  it('groups events by year and sorts years descending', () => {
    const events = [
      makeEvent({ id: 'e1', date: '2024-03-01' }),
      makeEvent({ id: 'e2', date: '2026-03-01' }),
      makeEvent({ id: 'e3', date: '2025-03-01' }),
    ]

    const { years, byYear } = buildHomeFeed(events, 'all', NOW)

    expect(years).toEqual(['2026', '2025', '2024'])
    expect(byYear['2024']).toHaveLength(1)
  })
})

function makeFestival(overrides: Partial<FestivalForHero> & { id: string; start_date: string }): FestivalForHero {
  return {
    name: 'Cosquín Rock',
    end_date: null,
    festival_attendance: [],
    ...overrides,
  }
}

describe('buildHomeHeroState', () => {
  it('picks a festival running today that the user is going to, over the next-show fallback', () => {
    const festival = makeFestival({
      id: 'f1',
      start_date: '2026-06-14',
      end_date: '2026-06-16',
      festival_attendance: [{ status: 'going' }],
    })
    const nextShow = { id: 'e1', date: '2026-07-01' } as EventWithAttendance

    const state = buildHomeHeroState(nextShow, [festival], NOW)

    expect(state).toEqual({ kind: 'festival', festival })
  })

  it('ignores a running festival the user has no attendance on', () => {
    const festival = makeFestival({
      id: 'f1',
      start_date: '2026-06-14',
      end_date: '2026-06-16',
      festival_attendance: [],
    })

    const state = buildHomeHeroState(undefined, [festival], NOW)

    expect(state.kind).not.toBe('festival')
  })

  it('ignores a festival that already ended', () => {
    const festival = makeFestival({
      id: 'f1',
      start_date: '2026-06-01',
      end_date: '2026-06-10',
      festival_attendance: [{ status: 'going' }],
    })

    const state = buildHomeHeroState(undefined, [festival], NOW)

    expect(state.kind).not.toBe('festival')
  })

  it('falls back to show-today when the next show is today and no festival is running', () => {
    const todayShow = { id: 'e1', date: '2026-06-15' } as EventWithAttendance

    const state = buildHomeHeroState(todayShow, [], NOW)

    expect(state).toEqual({ kind: 'show-today', event: todayShow })
  })

  it('falls back to normal with the days-until countdown when nothing is happening today', () => {
    const futureShow = { id: 'e1', date: '2026-06-20' } as EventWithAttendance

    const state = buildHomeHeroState(futureShow, [], NOW)

    expect(state).toEqual({ kind: 'normal', nextShow: futureShow, daysUntil: 5 })
  })

  it('is first-time rather than an empty countdown when there is no show at all', () => {
    const state = buildHomeHeroState(undefined, [], NOW)

    expect(state).toEqual({ kind: 'first-time' })
  })
})

describe('heroBadgeText', () => {
  it('reads "Esta noche · HH:MM" for show-today', () => {
    const event = makeEvent({ id: 'e1', date: '2026-06-15T21:00:00-03:00' })

    expect(heroBadgeText({ kind: 'show-today', event })).toBe('Esta noche · 21:00')
  })

  it('reads the formatted date and HH:MM for normal', () => {
    const nextShow = makeEvent({ id: 'e1', date: '2026-06-20T19:30:00-03:00' })

    expect(heroBadgeText({ kind: 'normal', nextShow, daysUntil: 5 })).toBe('20 jun · 19:30')
  })
})

describe('pickRecentSeen', () => {
  const NOW_RECENT = new Date(2026, 5, 15, 12, 0, 0)

  it('picks the 3 most recent "went" shows, mixed rated and unrated', () => {
    const events = [
      makeEvent({ id: 'a', date: '2026-05-01', attendance: [att('a1', 'went')] }),
      makeEvent({ id: 'b', date: '2026-05-10', attendance: [{ id: 'a2', status: 'went', user_id: 'u1', rating: 4, review: null }] }),
      makeEvent({ id: 'c', date: '2026-05-20', attendance: [{ id: 'a3', status: 'went', user_id: 'u1', rating: 5, review: null }] }),
      makeEvent({ id: 'd', date: '2026-04-01', attendance: [att('a4', 'went')] }),
    ]

    const result = pickRecentSeen(events, NOW_RECENT)

    expect(result.map((e) => e.id)).toEqual(['c', 'b', 'a'])
    expect(RECENT_SEEN_LIMIT).toBe(3)
  })

  it('returns fewer than the limit without placeholder slots', () => {
    const events = [makeEvent({ id: 'only', date: '2026-05-01', attendance: [att('a1', 'went')] })]

    expect(pickRecentSeen(events, NOW_RECENT)).toHaveLength(1)
  })

  it('returns an empty list when there are no "went" shows', () => {
    const events = [makeEvent({ id: 'a', date: '2026-05-01', attendance: [att('a1', 'interested')] })]

    expect(pickRecentSeen(events, NOW_RECENT)).toEqual([])
  })

  it('excludes a "went" show dated in the future — inconsistent data, not recent', () => {
    const events = [makeEvent({ id: 'future', date: '2026-07-01', attendance: [att('a1', 'went')] })]

    expect(pickRecentSeen(events, NOW_RECENT)).toEqual([])
  })
})

describe('weatherTag', () => {
  function makeWeather(overrides: Partial<EventWeather>): EventWeather {
    return {
      temperatureC: 20,
      precipitationMm: 0,
      weatherCode: 0,
      isRain: false,
      description: 'Despejado',
      hourLabel: '21:00',
      ...overrides,
    }
  }

  it('reads "llueve" when isRain', () => {
    expect(weatherTag(makeWeather({ isRain: true }))).toBe('llueve')
  })

  it('reads "no llueve" otherwise', () => {
    expect(weatherTag(makeWeather({ isRain: false }))).toBe('no llueve')
  })
})

describe('resolveInitialOpen', () => {
  const showToday = { kind: 'show-today', event: makeEvent({ id: 'e1', date: '2026-06-15' }) } as const
  const normal = { kind: 'normal', nextShow: makeEvent({ id: 'e1', date: '2026-06-20' }), daysUntil: 5 } as const

  it('opens the ticket when entrada is exactly "hoy" and the state is show-today', () => {
    expect(resolveInitialOpen('hoy', showToday)).toBe(true)
  })

  it('ignores the deep link when the state is not show-today', () => {
    expect(resolveInitialOpen('hoy', normal)).toBe(false)
  })

  it.each([
    ['HOY'],
    [' hoy'],
    [['hoy']],
    [''],
    [undefined],
  ])('ignores %j — strict equality with the literal only, never coerced', (entrada) => {
    expect(resolveInitialOpen(entrada as string | string[] | undefined, showToday)).toBe(false)
  })
})
