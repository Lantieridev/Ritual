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

import { createVenue } from '@/src/domains/venues/actions'
import { getCurrentUserId } from '@/src/core/auth/session'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  builder.insert = vi.fn(() => Promise.resolve(result))
  return builder
}

describe('createVenue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('rejects an unauthenticated caller', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await createVenue({ name: 'Niceto Club' } as never)
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects a missing or whitespace-only name without touching the database', async () => {
    const result = await createVenue({ name: '   ' } as never)

    expect(result).toEqual({ error: 'El nombre de la sede es obligatorio.' })
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('trims and inserts optional fields, then redirects to the list', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: null, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    await createVenue({
      name: '  Niceto Club  ',
      city: '  CABA  ',
      address: '  Cordoba 5500  ',
      country: '  Argentina  ',
    } as never)

    const builder = fromMock.mock.results[0].value as { insert: ReturnType<typeof vi.fn> }
    expect(builder.insert).toHaveBeenCalledWith({
      name: 'Niceto Club',
      city: 'CABA',
      address: 'Cordoba 5500',
      country: 'Argentina',
    })
    expect(mockRedirect).toHaveBeenCalledWith('/venues')
  })

  it('truncates a name longer than 200 characters', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: null, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))
    const longName = 'A'.repeat(250)

    await createVenue({ name: longName } as never)

    const builder = fromMock.mock.results[0].value as { insert: ReturnType<typeof vi.fn> }
    const inserted = builder.insert.mock.calls[0][0] as { name: string }
    expect(inserted.name).toHaveLength(200)
  })

  it('returns a sanitized error message when the insert fails, never the raw DB message', async () => {
    const fromMock = vi.fn(() =>
      makeQueryBuilder({ data: null, error: { message: 'duplicate key value violates unique constraint' } })
    )
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await createVenue({ name: 'Niceto Club' } as never)

    expect(result?.error).toBe('Ya existe un registro con esos datos.')
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
