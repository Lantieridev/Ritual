import { describe, it, expect, vi } from 'vitest'
import { wishlistSource } from '@/src/domains/taste/adapters/wishlist'
import { WISHLIST_WEIGHT } from '@/src/domains/taste/weights'

function makeSupabase(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(() => Promise.resolve(result))
  return { from: vi.fn(() => builder) }
}

describe('wishlistSource', () => {
  it('emits an artist signal with the flat wishlist weight, no decay', async () => {
    const supabase = makeSupabase({ data: [{ artist_id: 'a1' }, { artist_id: 'a2' }], error: null })

    const signals = await wishlistSource.collect({ userId: 'u1', supabase: supabase as never })

    expect(signals).toEqual([
      { source: 'wishlist', kind: 'artist', ref: 'a1', weight: WISHLIST_WEIGHT, observedAt: null, halfLifeDays: null, prior: false },
      { source: 'wishlist', kind: 'artist', ref: 'a2', weight: WISHLIST_WEIGHT, observedAt: null, halfLifeDays: null, prior: false },
    ])
  })

  it('returns no signals when the query errors out', async () => {
    const supabase = makeSupabase({ data: null, error: { message: 'boom' } })

    const signals = await wishlistSource.collect({ userId: 'u1', supabase: supabase as never })

    expect(signals).toEqual([])
  })
})
