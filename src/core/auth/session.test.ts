import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

import { getCurrentUserId } from '@/src/core/auth/session'

describe('getCurrentUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the current user id when a session exists', async () => {
    mockCreateClient.mockReturnValue(
      Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) } })
    )

    const id = await getCurrentUserId()

    expect(id).toBe('user-1')
  })

  it('returns null when there is no session', async () => {
    mockCreateClient.mockReturnValue(
      Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: null } }) } })
    )

    const id = await getCurrentUserId()

    expect(id).toBeNull()
  })

  it('returns null instead of throwing when the client itself errors', async () => {
    mockCreateClient.mockReturnValue(
      Promise.resolve({
        auth: { getUser: () => Promise.reject(new Error('network down')) },
      })
    )

    const id = await getCurrentUserId()

    expect(id).toBeNull()
  })
})
