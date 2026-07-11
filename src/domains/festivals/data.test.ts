import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

import { getFestivals, getFestivalById } from '@/src/domains/festivals/data'
import { getCurrentUserId } from '@/src/core/auth/session'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

describe('getFestivals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('scopes festival_attendance to the current user and returns the list', async () => {
    const festivals = [{ id: 'f1', name: 'Cosquin Rock' }]
    const builder = makeQueryBuilder({ data: festivals, error: null })
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getFestivals()

    expect(fromMock).toHaveBeenCalledWith('festivals')
    expect(builder.eq).toHaveBeenCalledWith('festival_attendance.user_id', 'user-1')
    expect(result).toEqual(festivals)
  })

  it('returns an empty list without touching the client when there is no logged-in user', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)

    const result = await getFestivals()

    expect(result).toEqual([])
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns an empty list when the query errors out', async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: 'boom' } })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await getFestivals()

    expect(result).toEqual([])
  })
})

describe('getFestivalById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('returns the festival scoped to the current user', async () => {
    const builder = makeQueryBuilder({ data: { id: 'f1', name: 'Cosquin Rock' }, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await getFestivalById('f1')

    expect(builder.eq).toHaveBeenCalledWith('festival_attendance.user_id', 'user-1')
    expect(result).toEqual({ id: 'f1', name: 'Cosquin Rock' })
  })

  it('returns null without touching the client when there is no logged-in user', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)

    const result = await getFestivalById('f1')

    expect(result).toBeNull()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns null when the query errors out', async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: 'boom' } })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await getFestivalById('f1')

    expect(result).toBeNull()
  })
})
