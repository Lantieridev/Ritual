import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { getWishlistArtistIds, toggleWishlist } from '@/src/domains/artists/wishlist-actions'
import { getCurrentUserId } from '@/src/core/auth/session'

function makeQueryBuilder(
  result: { data: unknown; error: unknown },
  mutateResult: { data: unknown; error: unknown } = { data: null, error: null }
) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.insert = vi.fn(() => Promise.resolve(mutateResult))
  builder.delete = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

const VALID_ARTIST_ID = '11111111-1111-1111-1111-111111111111'

describe('getWishlistArtistIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(
    'reads the wishlist through the session-aware Supabase client ' +
      "(regression test for the 2026-07-11 bug: RLS on wishlist is scoped `to authenticated`, " +
      'so toggling a wishlist item appeared to silently fail — it was writing fine but the ' +
      'anonymous read client could never see it back)',
    async () => {
      const fromMock = vi.fn(() =>
        makeQueryBuilder({ data: [{ artist_id: VALID_ARTIST_ID }], error: null })
      )
      mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))
      vi.mocked(getCurrentUserId).mockResolvedValue('user-1')

      const ids = await getWishlistArtistIds()

      expect(mockCreateClient).toHaveBeenCalledTimes(1)
      expect(fromMock).toHaveBeenCalledWith('wishlist')
      expect(ids).toEqual([VALID_ARTIST_ID])
    }
  )

  it('returns an empty list without touching the client when there is no logged-in user', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)

    const ids = await getWishlistArtistIds()

    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(ids).toEqual([])
  })
})

describe('toggleWishlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds the artist through the session-aware client when not already in the wishlist', async () => {
    const builder = makeQueryBuilder({ data: null, error: { code: 'PGRST116' } })
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')

    const result = await toggleWishlist(VALID_ARTIST_ID)

    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    expect(builder.insert).toHaveBeenCalledWith({ user_id: 'user-1', artist_id: VALID_ARTIST_ID })
    expect(result).toEqual({ inWishlist: true })
  })
})
