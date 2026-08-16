import { describe, it, expect, vi } from 'vitest'
import { profilePriorSource } from '@/src/domains/taste/adapters/profilePrior'

function makeSupabase(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  return { from: vi.fn(() => builder) }
}

describe('profilePriorSource', () => {
  it('emits one declared-genre prior signal per favorite genre key', async () => {
    const supabase = makeSupabase({ data: { favorite_genre_keys: ['indie', 'rock-nacional'] }, error: null })

    const signals = await profilePriorSource.collect({ userId: 'u1', supabase: supabase as never })

    expect(signals).toEqual([
      { source: 'profile-prior', kind: 'genre', ref: 'indie', weight: 1, observedAt: null, halfLifeDays: null, prior: true },
      { source: 'profile-prior', kind: 'genre', ref: 'rock-nacional', weight: 1, observedAt: null, halfLifeDays: null, prior: true },
    ])
  })

  it('returns no signals when the user has no taste_profiles row yet', async () => {
    const supabase = makeSupabase({ data: null, error: null })

    const signals = await profilePriorSource.collect({ userId: 'u1', supabase: supabase as never })

    expect(signals).toEqual([])
  })
})
