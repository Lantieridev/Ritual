import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

import { searchCatalog } from '@/src/domains/search/service'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.ilike = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.limit = vi.fn(() => Promise.resolve(result))
  return builder
}

function makeSupabase(overrides: Partial<Record<'events' | 'artists' | 'venues' | 'festivals', { data: unknown; error: unknown }>> = {}) {
  const defaults = { data: [], error: null }
  const byTable: Record<string, { data: unknown; error: unknown }> = {
    events: overrides.events ?? defaults,
    artists: overrides.artists ?? defaults,
    venues: overrides.venues ?? defaults,
    festivals: overrides.festivals ?? defaults,
  }
  const fromMock = vi.fn((table: string) => makeQueryBuilder(byTable[table]))
  return { from: fromMock }
}

describe('searchCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries festivals by name alongside events/artists/venues, capped at 8', async () => {
    const festivalRows = [{ id: 'f1', name: 'Cosquín Rock', edition: '2026', city: 'Córdoba', start_date: '2026-02-14' }]
    const supabase = makeSupabase({ festivals: { data: festivalRows, error: null } })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await searchCatalog('cosquin')

    expect(supabase.from).toHaveBeenCalledWith('festivals')
    expect(result.festivals).toEqual(festivalRows)
  })

  it('escapes % and _ wildcards before querying festivals, same as the other tables', async () => {
    const supabase = makeSupabase()
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))
    let festivalsPattern: unknown
    supabase.from = vi.fn((table: string) => {
      const builder = makeQueryBuilder({ data: [], error: null })
      if (table === 'festivals') {
        builder.ilike = vi.fn((_col: string, pattern: string) => {
          festivalsPattern = pattern
          return builder
        })
      }
      return builder
    })

    await searchCatalog('100% rock_show')

    expect(festivalsPattern).toBe('%100\\% rock\\_show%')
  })

  it('returns an empty festivals array when the query errors, without throwing', async () => {
    const supabase = makeSupabase({ festivals: { data: null, error: { message: 'boom' } } })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await searchCatalog('cosquin')

    expect(result.festivals).toEqual([])
  })

  it('returns EMPTY (including festivals: []) for a blank query, without hitting the database', async () => {
    const supabase = makeSupabase()
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await searchCatalog('   ')

    expect(result).toEqual({ events: [], artists: [], venues: [], festivals: [] })
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
