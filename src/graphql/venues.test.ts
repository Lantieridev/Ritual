import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/venues/data', () => ({
  getVenues: vi.fn(),
  getVenueById: vi.fn(),
}))

vi.mock('@/src/domains/venues/actions', () => ({
  insertVenue: vi.fn(),
  findOrCreateVenue: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}))

import { getVenues, getVenueById } from '@/src/domains/venues/data'
import { insertVenue, findOrCreateVenue } from '@/src/domains/venues/actions'
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

describe('venues GraphQL mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a venue and passes null optional args through as undefined', async () => {
    vi.mocked(insertVenue).mockResolvedValue({ id: 'v-new' })

    const body = await query(`mutation {
      createVenue(input: { name: "Niceto Club" }) { id existingId error }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ createVenue: { id: 'v-new', existingId: null, error: null } })
    expect(insertVenue).toHaveBeenCalledWith({
      name: 'Niceto Club',
      city: undefined,
      address: undefined,
      country: undefined,
    })
  })

  it('surfaces the existingId payload on a name collision, not a thrown GraphQL error', async () => {
    vi.mocked(insertVenue).mockResolvedValue({
      error: 'Ya existe una sede con ese nombre.',
      existingId: 'existing-1',
    })

    const body = await query(`mutation {
      createVenue(input: { name: "Niceto Club" }) { id existingId error }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      createVenue: { id: null, existingId: 'existing-1', error: 'Ya existe una sede con ese nombre.' },
    })
  })

  it('resolves findOrCreateVenue, passing optional args through', async () => {
    vi.mocked(findOrCreateVenue).mockResolvedValue({ id: 'v-1' })

    const body = await query(`mutation {
      findOrCreateVenue(name: "Niceto Club", city: "CABA") { id error }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ findOrCreateVenue: { id: 'v-1', error: null } })
    expect(findOrCreateVenue).toHaveBeenCalledWith('Niceto Club', 'CABA', undefined)
  })
})
