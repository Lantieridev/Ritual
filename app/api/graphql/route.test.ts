import { describe, it, expect, vi } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}))

describe('POST /api/graphql', () => {
  it('resolves the ping health-check query', async () => {
    const { POST } = await import('./route')

    const response = await POST(
      new Request('http://localhost/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ ping }' }),
      })
    )

    const body = await response.json()
    expect(body).toEqual({ data: { ping: 'pong' } })
  })
})
