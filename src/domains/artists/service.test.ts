import { describe, it, expect, vi, beforeEach } from 'vitest'
import { insertArtist, findOrCreateArtist, getWishlistArtists } from './service'
import { getCurrentUserId } from '@/src/core/auth/session'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.insert = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.ilike = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

describe('insertArtist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fails if not authenticated', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await insertArtist({ name: 'Artist' })
    expect(result).toEqual({ error: 'Usuario no autenticado' })
  })

  it('fails if name is empty after sanitization', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
    const result = await insertArtist({ name: '   ' })
    expect(result).toEqual({ error: 'El nombre del artista es obligatorio.' })
  })

  it('handles unique constraint violation (23505)', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
    
    const insertBuilder = makeQueryBuilder({ data: null, error: { code: '23505' } })
    const selectBuilder = makeQueryBuilder({ data: { id: 'existing-id' }, error: null })
    
    mockCreateClient.mockResolvedValue({
      from: vi.fn().mockReturnValueOnce(insertBuilder).mockReturnValueOnce(selectBuilder)
    })

    const result = await insertArtist({ name: 'Existing Artist' })
    expect(result).toEqual({ error: 'Ya existe un artista con ese nombre.', existingId: 'existing-id' })
    expect(selectBuilder.ilike).toHaveBeenCalledWith('name', 'Existing Artist')
  })

  it('handles general errors', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
    
    const insertBuilder = makeQueryBuilder({ data: null, error: { message: 'Some db error' } })
    
    mockCreateClient.mockResolvedValue({
      from: vi.fn().mockReturnValue(insertBuilder)
    })

    const result = await insertArtist({ name: 'Artist' })
    expect(result).toEqual({ error: 'Ocurrió un error inesperado. Intentá de nuevo.' })
  })

  it('inserts successfully', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
    
    const insertBuilder = makeQueryBuilder({ data: { id: 'new-id' }, error: null })
    
    const fromMock = vi.fn().mockReturnValue(insertBuilder)
    mockCreateClient.mockResolvedValue({
      from: fromMock
    })

    const result = await insertArtist({ name: 'New Artist', genre: 'Rock' })
    expect(result).toEqual({ id: 'new-id' })
    expect(insertBuilder.insert).toHaveBeenCalledWith({ name: 'New Artist', genre: 'Rock' })
  })
})

vi.mock('@/src/core/lib/find-or-create', () => ({
  findOrCreateByName: vi.fn(),
}))
import { findOrCreateByName } from '@/src/core/lib/find-or-create'

describe('findOrCreateArtist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fails if not authenticated', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await findOrCreateArtist('Artist')
    expect(result).toEqual({ error: 'Usuario no autenticado' })
  })

  it('fails if name is empty after sanitization', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
    const result = await findOrCreateArtist('   ')
    expect(result).toEqual({ error: 'El nombre del artista es obligatorio.' })
  })

  it('returns error from findOrCreateByName', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
    vi.mocked(findOrCreateByName).mockResolvedValue({ error: 'FindOrCreate error' })
    const supabase = {}
    mockCreateClient.mockResolvedValue(supabase)

    const result = await findOrCreateArtist('Artist')
    expect(result).toEqual({ error: 'FindOrCreate error' })
  })

  it('returns id on success', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
    vi.mocked(findOrCreateByName).mockResolvedValue({ id: 'found-id' })
    const supabase = {}
    mockCreateClient.mockResolvedValue(supabase)

    const result = await findOrCreateArtist('Artist', 'Pop')
    expect(result).toEqual({ id: 'found-id' })
    expect(findOrCreateByName).toHaveBeenCalledWith(supabase, 'artists', 'Artist', { genre: 'Pop' })
  })
})

describe('getWishlistArtists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array if not authenticated', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await getWishlistArtists()
    expect(result).toEqual([])
  })

  it('returns empty array on error', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
    const builder = makeQueryBuilder({ data: null, error: { message: 'db error' } })
    mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) })

    const result = await getWishlistArtists()
    expect(result).toEqual([])
  })

  it('filters out null artists', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
    const builder = makeQueryBuilder({ 
      data: [{ artists: { id: '1', name: 'A1' } }, { artists: null }, { artists: { id: '2', name: 'A2' } }], 
      error: null 
    })
    mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) })

    const result = await getWishlistArtists()
    expect(result).toEqual([{ id: '1', name: 'A1' }, { id: '2', name: 'A2' }])
  })
})
