import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()
const mockRedirect = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}))

import { createArtist, insertArtist } from '@/src/domains/artists/actions'
import { getCurrentUserId } from '@/src/core/auth/session'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  builder.insert = vi.fn(() => builder)
  builder.select = vi.fn(() => builder)
  builder.single = vi.fn(() => Promise.resolve(result))
  return builder
}

function makeLookupBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.ilike = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  return builder
}

describe('createArtist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('rejects an unauthenticated caller', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await createArtist({ name: 'Bandalos Chinos' } as never)
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects a missing or whitespace-only name without touching the database', async () => {
    const result = await createArtist({ name: '   ' } as never)

    expect(result).toEqual({ error: 'El nombre del artista es obligatorio.' })
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('trims name and genre, then redirects to the list', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: { id: 'a-new' }, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    await createArtist({ name: '  Bandalos Chinos  ', genre: '  Indie  ' } as never)

    const builder = fromMock.mock.results[0].value as { insert: ReturnType<typeof vi.fn> }
    expect(builder.insert).toHaveBeenCalledWith({ name: 'Bandalos Chinos', genre: 'Indie' })
    expect(mockRedirect).toHaveBeenCalledWith('/artists')
  })

  it('truncates a name longer than 200 characters', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: { id: 'a-new' }, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))
    const longName = 'A'.repeat(250)

    await createArtist({ name: longName } as never)

    const builder = fromMock.mock.results[0].value as { insert: ReturnType<typeof vi.fn> }
    const inserted = builder.insert.mock.calls[0][0] as { name: string }
    expect(inserted.name).toHaveLength(200)
  })

  it('returns a sanitized error message when the insert fails, never the raw DB message', async () => {
    const fromMock = vi.fn(() =>
      makeQueryBuilder({ data: null, error: { message: 'duplicate key value violates unique constraint' } })
    )
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await createArtist({ name: 'Bandalos Chinos' } as never)

    expect(result?.error).toBe('Ya existe un registro con esos datos.')
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  // A name-collision used to dead-end on the same generic message as any
  // other DB error — now it looks up the existing row so the form can link
  // straight to it instead of leaving the user stuck.
  it('looks up and returns the existing artist id on a name collision', async () => {
    const insertBuilder = makeQueryBuilder({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint "artists_name_key_unique"' },
    })
    const lookupBuilder = makeLookupBuilder({ data: { id: 'existing-artist-1' }, error: null })
    let callCount = 0
    const fromMock = vi.fn(() => {
      callCount++
      return callCount === 1 ? insertBuilder : lookupBuilder
    })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await createArtist({ name: 'Bandalos Chinos' } as never)

    expect(lookupBuilder.ilike).toHaveBeenCalledWith('name', 'Bandalos Chinos')
    expect(result).toEqual({ error: 'Ya existe un artista con ese nombre.', existingId: 'existing-artist-1' })
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})

describe('insertArtist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('returns the new id without redirecting, for callers other than the form submit flow', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: { id: 'a-new' }, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await insertArtist({ name: 'Bandalos Chinos' } as never)

    expect(result).toEqual({ id: 'a-new' })
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
