import { describe, it, expect, vi, beforeEach } from 'vitest'

const isLastFmConfigured = vi.fn()
const getLastFmUserTopArtists = vi.fn()

vi.mock('@/src/core/lib/lastfm', () => ({ isLastFmConfigured: () => isLastFmConfigured() }))
vi.mock('@/src/domains/taste/clients/lastfm', () => ({
  getLastFmUserTopArtists: (...args: unknown[]) => getLastFmUserTopArtists(...args),
}))

import { importLastfmForUser } from '@/src/domains/taste/importLastfmForUser'

function makeArtist(name: string, rank: number) {
  return { name, rank }
}

/** `artists` resolves name_key -> id; `lastfm_imports` records the upsert/select/delete calls made against it. */
function makeSupabase(opts: {
  matchedArtists?: Array<{ id: string; name_key: string }>
  existingImportKeys?: string[]
}) {
  const artistsBuilder: Record<string, unknown> = {}
  artistsBuilder.select = vi.fn(() => artistsBuilder)
  artistsBuilder.in = vi.fn(() => Promise.resolve({ data: opts.matchedArtists ?? [], error: null }))

  const upsert = vi.fn<(rows: unknown, opts: unknown) => Promise<{ error: null }>>(() =>
    Promise.resolve({ error: null })
  )
  const deleteEq = vi.fn(() => Promise.resolve({ error: null }))
  const deleteBuilder: Record<string, unknown> = { eq: vi.fn(() => deleteBuilder), in: deleteEq }
  const selectExisting: Record<string, unknown> = {}
  selectExisting.select = vi.fn(() => selectExisting)
  selectExisting.eq = vi.fn(() =>
    Promise.resolve({ data: (opts.existingImportKeys ?? []).map((k) => ({ artist_name_key: k })), error: null })
  )

  const importsBuilder = { upsert, select: selectExisting.select, delete: vi.fn(() => deleteBuilder) }

  const from = vi.fn((table: string) => {
    if (table === 'artists') return artistsBuilder
    return importsBuilder
  })

  return { from, upsert, deleteEq, selectExisting }
}

describe('importLastfmForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isLastFmConfigured.mockReturnValue(true)
  })

  it('no-ops with an empty success shape when LASTFM_API_KEY is not configured', async () => {
    isLastFmConfigured.mockReturnValue(false)
    const supabase = makeSupabase({})

    const result = await importLastfmForUser(supabase as never, 'u1', 'martin')

    expect(result).toEqual({ imported: 0, unmatched: 0 })
    expect(getLastFmUserTopArtists).not.toHaveBeenCalled()
  })

  it('returns notFound without writing anything when the username does not exist', async () => {
    getLastFmUserTopArtists.mockResolvedValue({ artists: null, notFound: true })
    const supabase = makeSupabase({})

    const result = await importLastfmForUser(supabase as never, 'u1', 'nope')

    expect(result).toEqual({ imported: 0, unmatched: 0, notFound: true })
    expect(supabase.upsert).not.toHaveBeenCalled()
  })

  it('returns rateLimited and stops without writing anything', async () => {
    getLastFmUserTopArtists.mockResolvedValue({ artists: null, rateLimited: true })
    const supabase = makeSupabase({})

    const result = await importLastfmForUser(supabase as never, 'u1', 'martin')

    expect(result).toEqual({ imported: 0, unmatched: 0, rateLimited: true })
    expect(supabase.upsert).not.toHaveBeenCalled()
  })

  it('imports matched and unmatched artists, capped at the top 50', async () => {
    const artists = Array.from({ length: 60 }, (_, i) => makeArtist(`Artist ${i}`, i + 1))
    getLastFmUserTopArtists.mockResolvedValue({ artists })
    const supabase = makeSupabase({ matchedArtists: [{ id: 'a0', name_key: 'artist 0' }] })

    const result = await importLastfmForUser(supabase as never, 'u1', 'martin', { runStart: '2026-08-16T00:00:00Z' })

    expect(supabase.upsert).toHaveBeenCalledTimes(1)
    const rows = supabase.upsert.mock.calls[0][0] as Array<{ artist_id: string | null; rank: number }>
    expect(rows).toHaveLength(50)
    expect(rows[0].artist_id).toBe('a0')
    expect(rows[1].artist_id).toBeNull()
    expect(result).toEqual({ imported: 50, unmatched: 49 })
  })

  it('deletes stale rows that fell outside the new top set', async () => {
    getLastFmUserTopArtists.mockResolvedValue({ artists: [makeArtist('Artist 0', 1)] })
    const supabase = makeSupabase({ existingImportKeys: ['artist 0', 'an old artist'] })

    await importLastfmForUser(supabase as never, 'u1', 'martin')

    expect(supabase.deleteEq).toHaveBeenCalledWith('artist_name_key', ['an old artist'])
  })

  it('does not delete anything when there are no stale rows', async () => {
    getLastFmUserTopArtists.mockResolvedValue({ artists: [makeArtist('Artist 0', 1)] })
    const supabase = makeSupabase({ existingImportKeys: ['artist 0'] })

    await importLastfmForUser(supabase as never, 'u1', 'martin')

    expect(supabase.deleteEq).not.toHaveBeenCalled()
  })

  it('paces itself with the injected throttle before the Last.fm call, for callers that loop over many users', async () => {
    getLastFmUserTopArtists.mockResolvedValue({ artists: [] })
    const supabase = makeSupabase({})
    const throttle = vi.fn(() => Promise.resolve())

    await importLastfmForUser(supabase as never, 'u1', 'martin', { throttle })

    expect(throttle).toHaveBeenCalledTimes(1)
  })
})
