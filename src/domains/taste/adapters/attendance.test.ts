import { describe, it, expect, vi } from 'vitest'
import { attendanceSource } from '@/src/domains/taste/adapters/attendance'
import { wentWeight, GOING_WEIGHT, INTERESTED_WEIGHT, WENT_HALF_LIFE_DAYS } from '@/src/domains/taste/weights'

function makeSupabase(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(() => Promise.resolve(result))
  return { from: vi.fn(() => builder) }
}

describe('attendanceSource', () => {
  it('weighs a rated "went" show by its rating, decaying from the event date', async () => {
    const supabase = makeSupabase({
      data: [{ status: 'went', rating: 5, events: { date: '2024-01-01', lineups: [{ artist_id: 'a1' }] } }],
      error: null,
    })

    const signals = await attendanceSource.collect({ userId: 'u1', supabase: supabase as never })

    expect(signals).toEqual([
      { source: 'attendance', kind: 'artist', ref: 'a1', weight: wentWeight(5), observedAt: '2024-01-01', halfLifeDays: WENT_HALF_LIFE_DAYS, prior: false },
    ])
  })

  it('treats an unrated "went" show as rating 0, not as if it never happened', async () => {
    const supabase = makeSupabase({
      data: [{ status: 'went', rating: null, events: { date: '2024-01-01', lineups: [{ artist_id: 'a1' }] } }],
      error: null,
    })

    const signals = await attendanceSource.collect({ userId: 'u1', supabase: supabase as never })

    expect(signals[0].weight).toBe(wentWeight(0))
  })

  it('emits one signal per lineup artist when a show has more than one', async () => {
    const supabase = makeSupabase({
      data: [{ status: 'went', rating: 4, events: { date: '2024-06-01', lineups: [{ artist_id: 'a1' }, { artist_id: 'a2' }] } }],
      error: null,
    })

    const signals = await attendanceSource.collect({ userId: 'u1', supabase: supabase as never })

    expect(signals.map((s) => s.ref)).toEqual(['a1', 'a2'])
  })

  it('weighs "going" and "interested" flat, with no time decay', async () => {
    const supabase = makeSupabase({
      data: [
        { status: 'going', rating: null, events: { date: '2099-01-01', lineups: [{ artist_id: 'a1' }] } },
        { status: 'interested', rating: null, events: { date: '2099-02-01', lineups: [{ artist_id: 'a2' }] } },
      ],
      error: null,
    })

    const signals = await attendanceSource.collect({ userId: 'u1', supabase: supabase as never })

    expect(signals).toEqual([
      { source: 'attendance', kind: 'artist', ref: 'a1', weight: GOING_WEIGHT, observedAt: null, halfLifeDays: null, prior: false },
      { source: 'attendance', kind: 'artist', ref: 'a2', weight: INTERESTED_WEIGHT, observedAt: null, halfLifeDays: null, prior: false },
    ])
  })

  it('emits no signal for a show with no lineup rows', async () => {
    const supabase = makeSupabase({
      data: [{ status: 'went', rating: 3, events: { date: '2024-01-01', lineups: [] } }],
      error: null,
    })

    const signals = await attendanceSource.collect({ userId: 'u1', supabase: supabase as never })

    expect(signals).toEqual([])
  })

  it('returns no signals when the query errors out', async () => {
    const supabase = makeSupabase({ data: null, error: { message: 'boom' } })

    const signals = await attendanceSource.collect({ userId: 'u1', supabase: supabase as never })

    expect(signals).toEqual([])
  })
})
