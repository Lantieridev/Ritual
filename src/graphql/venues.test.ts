import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/venues/data', () => ({
  getVenues: vi.fn(),
  getVenueById: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}))

import { getVenues, getVenueById } from '@/src/domains/venues/data'
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

describe('venues GraphQL schema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves the venues query through the existing data layer', async () => {
    vi.mocked(getVenues).mockResolvedValue([
      { id: 'v1', name: 'Niceto', city: 'CABA', country: null, address: null, lat: null, lng: null },
    ])

    const body = await query('{ venues { id name city } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ venues: [{ id: 'v1', name: 'Niceto', city: 'CABA' }] })
  })

  it('resolves a single venue by id, null when it does not exist', async () => {
    vi.mocked(getVenueById).mockResolvedValue(null)

    const body = await query('{ venue(id: "missing") { id } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ venue: null })
    expect(getVenueById).toHaveBeenCalledWith('missing')
  })
})
