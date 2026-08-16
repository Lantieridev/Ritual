import { describe, it, expect, vi } from 'vitest'
import { lastfmSource } from '@/src/domains/taste/adapters/lastfm'
import { lastfmWeight } from '@/src/domains/taste/weights'

function makeSupabase(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.not = vi.fn(() => Promise.resolve(result))
  return { from: vi.fn(() => builder) }
}

describe('lastfmSource', () => {
  it('emits an artist signal weighted by rank, for rows already matched to the catalog', async () => {
    const supabase = makeSupabase({ data: [{ artist_id: 'a1', rank: 1 }, { artist_id: 'a2', rank: 10 }], error: null })

    const signals = await lastfmSource.collect({ userId: 'u1', supabase: supabase as never })

    expect(signals).toEqual([
      { source: 'lastfm', kind: 'artist', ref: 'a1', weight: lastfmWeight(1), observedAt: null, halfLifeDays: null, prior: false },
      { source: 'lastfm', kind: 'artist', ref: 'a2', weight: lastfmWeight(10), observedAt: null, halfLifeDays: null, prior: false },
    ])
  })

  it('returns no signals when the query errors out', async () => {
    const supabase = makeSupabase({ data: null, error: { message: 'boom' } })

    const signals = await lastfmSource.collect({ userId: 'u1', supabase: supabase as never })

    expect(signals).toEqual([])
  })
})
