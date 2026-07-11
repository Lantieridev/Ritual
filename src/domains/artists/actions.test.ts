import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()
const mockRedirect = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}))

import { createArtist } from '@/src/domains/artists/actions'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  builder.insert = vi.fn(() => Promise.resolve(result))
  return builder
}

describe('createArtist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects a missing or whitespace-only name without touching the database', async () => {
    const result = await createArtist({ name: '   ' } as never)

    expect(result).toEqual({ error: 'El nombre del artista es obligatorio.' })
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('trims name and genre, then redirects to the list', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: null, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    await createArtist({ name: '  Bandalos Chinos  ', genre: '  Indie  ' } as never)

    const builder = fromMock.mock.results[0].value as { insert: ReturnType<typeof vi.fn> }
    expect(builder.insert).toHaveBeenCalledWith({ name: 'Bandalos Chinos', genre: 'Indie' })
    expect(mockRedirect).toHaveBeenCalledWith('/artists')
  })

  it('truncates a name longer than 200 characters', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: null, error: null }))
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
})
