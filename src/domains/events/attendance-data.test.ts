import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

import { getAttendanceForEvent } from '@/src/domains/events/attendance-data'
import { getCurrentUserId } from '@/src/core/auth/session'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  return builder
}

describe('getAttendanceForEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('returns attendance scoped to the current user, flattening the memory array', async () => {
    const builder = makeQueryBuilder({
      data: { id: 'att-1', status: 'went', memories: [{ id: 'mem-1', rating: 5, review: 'Genial', notes: null }] },
      error: null,
    })
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getAttendanceForEvent('evt-1')

    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(result).toEqual({
      id: 'att-1',
      status: 'went',
      memory: { id: 'mem-1', rating: 5, review: 'Genial', notes: null },
    })
  })

  it('returns null memory when there are no memories for the attendance', async () => {
    const builder = makeQueryBuilder({
      data: { id: 'att-1', status: 'interested', memories: [] },
      error: null,
    })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await getAttendanceForEvent('evt-1')

    expect(result?.memory).toBeNull()
  })

  it('returns null without touching the client when there is no logged-in user', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)

    const result = await getAttendanceForEvent('evt-1')

    expect(result).toBeNull()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns null when there is no attendance record for the event', async () => {
    const builder = makeQueryBuilder({ data: null, error: { code: 'PGRST116' } })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await getAttendanceForEvent('evt-1')

    expect(result).toBeNull()
  })
})
