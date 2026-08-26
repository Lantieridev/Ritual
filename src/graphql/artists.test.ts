import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/artists/data', () => ({
  getArtists: vi.fn(),
  getArtistById: vi.fn(),
  getArtistEvents: vi.fn(),
  getArtistEventsBatch: vi.fn(),
}))

vi.mock('@/src/domains/artists/service', () => ({
  listArtists: vi.fn(),
  findArtistById: vi.fn(),
  insertArtist: vi.fn(),
  findOrCreateArtist: vi.fn(),
  getWishlistArtistIds: vi.fn(),
  toggleWishlist: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}))

import { getArtistEvents, getArtistEventsBatch } from '@/src/domains/artists/data'
import {
  listArtists,
  findArtistById,
  insertArtist,
  findOrCreateArtist,
  getWishlistArtistIds,
  toggleWishlist,
} from '@/src/domains/artists/service'
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
    vi.mocked(listArtists).mockResolvedValue([
      { id: 'a1', name: 'Bandalos Chinos', genre: 'Indie', image_url: 'https://x/y.png', spotify_id: 'sp1' },
    ])

    const body = await query('{ artists { id name imageUrl spotifyId } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      artists: [{ id: 'a1', name: 'Bandalos Chinos', imageUrl: 'https://x/y.png', spotifyId: 'sp1' }],
    })
  })

  it('resolves a single artist by id, null when it does not exist', async () => {
    vi.mocked(findArtistById).mockResolvedValue(null)

    const body = await query('{ artist(id: "missing") { id } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ artist: null })
    expect(findArtistById).toHaveBeenCalledWith('missing')
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

describe('artists GraphQL parity additions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Regresion de paridad: el detalle de artista se dibuja enteramente sobre
  // este historial, que antes no existia en el schema.
  it('exposes the show history already attached to an artist detail read', async () => {
    vi.mocked(findArtistById).mockResolvedValue({
      id: 'a1',
      name: 'Bandalos Chinos',
      genre: null,
      image_url: null,
      spotify_id: null,
      events: [
        {
          id: 'e1',
          name: 'Show',
          date: '2026-01-01',
          venues: { name: 'Niceto', city: 'CABA' },
          event_photos: [{ storage_path: 'p/1.jpg', caption: null }],
          attendance: [{ status: 'went', rating: 5, review: 'brutal' }],
        },
      ],
    })

    const body = await query(`{
      artist(id: "a1") {
        events {
          id
          venue { name city }
          photos { storagePath caption }
          attendance { status rating review }
        }
      }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data.artist.events).toEqual([
      {
        id: 'e1',
        venue: { name: 'Niceto', city: 'CABA' },
        photos: [{ storagePath: 'p/1.jpg', caption: null }],
        attendance: [{ status: 'went', rating: 5, review: 'brutal' }],
      },
    ])
    expect(getArtistEventsBatch).not.toHaveBeenCalled()
  })

  it('loads the show history on demand when the row came from the list query', async () => {
    vi.mocked(listArtists).mockResolvedValue([
      { id: 'a1', name: 'Bandalos Chinos', genre: null, image_url: null, spotify_id: null },
    ])
    vi.mocked(getArtistEventsBatch).mockResolvedValue([[
      { id: 'e1', name: 'Show', date: '2026-01-01', venues: null, event_photos: [], attendance: [] },
    ]])

    const body = await query('{ artists { id events { id } } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ artists: [{ id: 'a1', events: [{ id: 'e1' }] }] })
    expect(getArtistEventsBatch).toHaveBeenCalledWith(['a1'])
  })

  // La wishlist no tenia ninguna representacion en el schema: sin esto el
  // boton de seguir y /wishlist se quedaban sin backend al migrar.
  it('resolves the wishlist ids query', async () => {
    vi.mocked(getWishlistArtistIds).mockResolvedValue(['a1', 'a2'])

    const body = await query('{ wishlistArtistIds }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ wishlistArtistIds: ['a1', 'a2'] })
  })

  it('returns the resulting wishlist state so the optimistic toggle can reconcile', async () => {
    vi.mocked(toggleWishlist).mockResolvedValue({ inWishlist: true })

    const body = await query('mutation { toggleWishlist(artistId: "a1") { inWishlist error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ toggleWishlist: { inWishlist: true, error: null } })
    expect(toggleWishlist).toHaveBeenCalledWith('a1')
  })

  it('surfaces a toggle failure in the payload instead of throwing', async () => {
    vi.mocked(toggleWishlist).mockResolvedValue({ inWishlist: false, error: 'No autenticado' })

    const body = await query('mutation { toggleWishlist(artistId: "a1") { inWishlist error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ toggleWishlist: { inWishlist: false, error: 'No autenticado' } })
  })
})
