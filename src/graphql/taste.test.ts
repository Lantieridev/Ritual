import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/taste/service', () => ({
  listGenres: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}))

import { listGenres } from '@/src/domains/taste/service'
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

describe('taste GraphQL schema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves the genres query with the canonical vocabulary, sorted', async () => {
    vi.mocked(listGenres).mockResolvedValue([
      { key: 'rock-nacional', label: 'Rock Nacional' },
      { key: 'indie', label: 'Indie' },
    ])

    const body = await query('{ genres { key label } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      genres: [
        { key: 'rock-nacional', label: 'Rock Nacional' },
        { key: 'indie', label: 'Indie' },
      ],
    })
  })

  it('resolves an empty list without throwing when the catalog read fails upstream', async () => {
    vi.mocked(listGenres).mockResolvedValue([])

    const body = await query('{ genres { key label } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ genres: [] })
  })
})
