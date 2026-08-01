import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthSessionMissingError } from '@supabase/supabase-js'

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

  it('does not log an error for the expected anonymous-visitor case (no session)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCreateClient.mockReturnValue(
      Promise.resolve({
        auth: {
          getUser: () =>
            Promise.resolve({ data: { user: null }, error: new AuthSessionMissingError() }),
        },
      })
    )

    const id = await getCurrentUserId()

    expect(id).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('logs a genuine auth error (not a missing session)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const realError = { name: 'AuthApiError', __isAuthError: true, message: 'invalid token' }
    mockCreateClient.mockReturnValue(
      Promise.resolve({
        auth: { getUser: () => Promise.resolve({ data: { user: null }, error: realError }) },
      })
    )

    const id = await getCurrentUserId()

    expect(id).toBeNull()
    expect(consoleError).toHaveBeenCalledWith(
      'supabase.auth.getUser() failed in getCurrentUserId:',
      realError
    )
    consoleError.mockRestore()
  })
})
