import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/artists/data', () => ({
  getArtists: vi.fn(),
  getArtistById: vi.fn(),
}))

vi.mock('@/src/domains/artists/actions', () => ({
  insertArtist: vi.fn(),
  findOrCreateArtist: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}))

import { getArtists, getArtistById } from '@/src/domains/artists/data'
import { insertArtist, findOrCreateArtist } from '@/src/domains/artists/actions'
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

describe('artists GraphQL mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an artist and passes optional args through', async () => {
    vi.mocked(insertArtist).mockResolvedValue({ id: 'a-new' })

    const body = await query(`mutation {
      createArtist(input: { name: "Bandalos Chinos", genre: "Indie" }) { id existingId error }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ createArtist: { id: 'a-new', existingId: null, error: null } })
    expect(insertArtist).toHaveBeenCalledWith({ name: 'Bandalos Chinos', genre: 'Indie' })
  })

  it('surfaces the existingId payload on a name collision, not a thrown GraphQL error', async () => {
    vi.mocked(insertArtist).mockResolvedValue({
      error: 'Ya existe un artista con ese nombre.',
      existingId: 'existing-1',
    })

    const body = await query(`mutation {
      createArtist(input: { name: "Bandalos Chinos" }) { id existingId error }
    }`)

    expect(body.data).toEqual({
      createArtist: { id: null, existingId: 'existing-1', error: 'Ya existe un artista con ese nombre.' },
    })
  })

  it('resolves findOrCreateArtist, passing optional args through', async () => {
    vi.mocked(findOrCreateArtist).mockResolvedValue({ id: 'a-1' })

    const body = await query(`mutation {
      findOrCreateArtist(name: "Bandalos Chinos") { id error }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ findOrCreateArtist: { id: 'a-1', error: null } })
    expect(findOrCreateArtist).toHaveBeenCalledWith('Bandalos Chinos', undefined)
  })
})
