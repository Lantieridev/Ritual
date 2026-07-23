import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/auth/data', () => ({
  getProfile: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}))

import { getProfile } from '@/src/domains/auth/data'
import { POST } from '@/app/api/graphql/route'

async function query(source: string) {
  const response = await POST(
    new Request('http://localhost/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: source }),
    })
  )
  return response.json()
}

describe('auth GraphQL schema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves "me" for the current session, no id argument needed', async () => {
    vi.mocked(getProfile).mockResolvedValue({ id: 'u1', username: 'martin', bio: null })

    const body = await query('{ me { id username } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ me: { id: 'u1', username: 'martin' } })
    expect(getProfile).toHaveBeenCalledWith()
  })

  it('resolves "me" as null when there is no session', async () => {
    vi.mocked(getProfile).mockResolvedValue(null)

    const body = await query('{ me { id } }')

    expect(body.data).toEqual({ me: null })
  })

  it('resolves another user\'s profile by id', async () => {
    vi.mocked(getProfile).mockResolvedValue({ id: 'u2', username: 'otra', bio: null })

    const body = await query('{ profile(id: "u2") { username } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ profile: { username: 'otra' } })
    expect(getProfile).toHaveBeenCalledWith('u2')
  })
})
