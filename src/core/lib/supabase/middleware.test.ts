import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthSessionMissingError } from '@supabase/supabase-js'

const mockGetUser = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}))

import { updateSession } from '@/src/core/lib/supabase/middleware'

function makeRequest(path: string) {
  return new NextRequest(new URL(path, 'http://localhost:3000'))
}

describe('updateSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows an anonymous visitor through on a public path', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() })

    const response = await updateSession(makeRequest('/'))

    expect(response.status).toBe(200)
  })

  it('redirects an anonymous visitor away from a protected path', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() })

    const response = await updateSession(makeRequest('/profile'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('lets an authenticated user through a protected path', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const response = await updateSession(makeRequest('/profile'))

    expect(response.status).toBe(200)
  })

  it('redirects an anonymous visitor away from /modo-recital', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() })

    const response = await updateSession(makeRequest('/modo-recital'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('does not log an error for the expected anonymous-visitor case (no session)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() })

    await updateSession(makeRequest('/'))

    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('logs a genuine auth error (not a missing session)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const realError = { name: 'AuthApiError', __isAuthError: true, message: 'invalid token' }
    mockGetUser.mockResolvedValue({ data: { user: null }, error: realError })

    await updateSession(makeRequest('/'))

    expect(consoleError).toHaveBeenCalledWith(
      'supabase.auth.getUser() failed in middleware:',
      realError
    )
    consoleError.mockRestore()
  })
})
