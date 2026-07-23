import { describe, it, expect, vi } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}))

import { GET, POST, OPTIONS } from './route'

describe('POST /api/graphql', () => {
  it('resolves the ping health-check query', async () => {
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

describe('GET /api/graphql', () => {
  it('resolves a query passed as a query-string param', async () => {
    const response = await GET(
      new Request('http://localhost/api/graphql?query=' + encodeURIComponent('{ ping }'))
    )

    const body = await response.json()
    expect(body).toEqual({ data: { ping: 'pong' } })
  })

  it('serves the GraphiQL page when no query is provided, for humans hitting it in a browser', async () => {
    const response = await GET(
      new Request('http://localhost/api/graphql', { headers: { Accept: 'text/html' } })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
  })
})

describe('OPTIONS /api/graphql', () => {
  it('answers the CORS preflight without erroring', async () => {
    const response = await OPTIONS(new Request('http://localhost/api/graphql', { method: 'OPTIONS' }))

    expect(response.status).toBeLessThan(400)
  })
})
