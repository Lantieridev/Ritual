import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/artists/data', () => ({
  getArtists: vi.fn(),
  getArtistById: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}))

import { getArtists, getArtistById } from '@/src/domains/artists/data'
import { POST } from '@/app/api/graphql/route'

async function query(source: string) {
  const response = await POST(
    new Request('http://localhost/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: source }),
    })
  )
  return response.json()
}

describe('artists GraphQL schema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves the artists query, exposing DB snake_case fields as camelCase', async () => {
    vi.mocked(getArtists).mockResolvedValue([
      { id: 'a1', name: 'Bandalos Chinos', genre: 'Indie', image_url: 'https://x/y.png', spotify_id: 'sp1' },
    ])

    const body = await query('{ artists { id name imageUrl spotifyId } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      artists: [{ id: 'a1', name: 'Bandalos Chinos', imageUrl: 'https://x/y.png', spotifyId: 'sp1' }],
    })
  })

  it('resolves a single artist by id, null when it does not exist', async () => {
    vi.mocked(getArtistById).mockResolvedValue(null)

    const body = await query('{ artist(id: "missing") { id } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ artist: null })
    expect(getArtistById).toHaveBeenCalledWith('missing')
  })
})
