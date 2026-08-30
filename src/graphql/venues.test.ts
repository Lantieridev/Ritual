import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/venues/service', () => ({
  listVenues: vi.fn(),
  findVenueById: vi.fn(),
  insertVenue: vi.fn(),
  findOrCreateVenue: vi.fn(),
  listVenueEventsBatch: vi.fn(),
  listVenueTipsBatch: vi.fn(),
  addVenueTip: vi.fn(),
  removeVenueTip: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}))

import {
  listVenues,
  findVenueById,
  insertVenue,
  findOrCreateVenue,
  listVenueEventsBatch,
  listVenueTipsBatch,
  addVenueTip,
  removeVenueTip,
} from '@/src/domains/venues/service'
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

  it('resolves the venues query through the service layer', async () => {
    vi.mocked(listVenues).mockResolvedValue([
      { id: 'v1', name: 'Niceto', city: 'CABA', country: null, address: null, lat: null, lng: null },
    ])

    const body = await query('{ venues { id name city } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ venues: [{ id: 'v1', name: 'Niceto', city: 'CABA' }] })
  })

  it('resolves a single venue by id, null when it does not exist', async () => {
    vi.mocked(findVenueById).mockResolvedValue(null)

    const body = await query('{ venue(id: "missing") { id } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ venue: null })
    expect(findVenueById).toHaveBeenCalledWith('missing')
  })

  // Regresion de paridad: el detalle de sede se dibuja enteramente sobre el
  // historial de shows, que antes no existia en el schema.
  it('exposes the show history already attached to a venue detail read', async () => {
    vi.mocked(findVenueById).mockResolvedValue({
      id: 'v1',
      name: 'Niceto',
      city: null,
      country: null,
      address: null,
      lat: null,
      lng: null,
      events: [
        {
          id: 'e1',
          name: 'Show',
          date: '2026-01-01',
          lineups: [{ artists: { name: 'Coldplay' } }],
          attendance: [{ status: 'went', zone: 'Campo General' }],
        },
      ],
    })

    const body = await query(
      '{ venue(id: "v1") { events { id date lineups { artist { name } } attendance { status zone } } } }'
    )

    expect(body.errors).toBeUndefined()
    expect(body.data.venue.events).toEqual([
      {
        id: 'e1',
        date: '2026-01-01',
        lineups: [{ artist: { name: 'Coldplay' } }],
        attendance: [{ status: 'went', zone: 'Campo General' }],
      },
    ])
    expect(listVenueEventsBatch).not.toHaveBeenCalled()
  })

  // La query de listado no trae la relacion, asi que el campo la carga bajo
  // demanda en vez de devolver [] y perder el dato en silencio.
  it('loads the show history on demand when the row came from the list query', async () => {
    vi.mocked(listVenues).mockResolvedValue([
      { id: 'v1', name: 'Niceto', city: null, country: null, address: null, lat: null, lng: null },
    ])
    vi.mocked(listVenueEventsBatch).mockResolvedValue([[
      { id: 'e1', name: 'Show', date: '2026-01-01', lineups: [], attendance: [] },
    ]])

    const body = await query('{ venues { id events { id } } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ venues: [{ id: 'v1', events: [{ id: 'e1' }] }] })
    expect(listVenueEventsBatch).toHaveBeenCalledWith(['v1'])
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

  it('adds a venue tip', async () => {
    vi.mocked(addVenueTip).mockResolvedValue({})

    const body = await query(`mutation {
      addVenueTip(venueId: "v1", body: "Llegá temprano", category: "cola") { success error }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ addVenueTip: { success: true, error: null } })
    expect(addVenueTip).toHaveBeenCalledWith('v1', 'Llegá temprano', 'cola')
  })

  it('reports addVenueTip failure through success:false, not a thrown GraphQL error', async () => {
    vi.mocked(addVenueTip).mockResolvedValue({ error: 'Categoría inválida.' })

    const body = await query('mutation { addVenueTip(venueId: "v1", body: "x", category: "mala") { success error } }')

    expect(body.data).toEqual({ addVenueTip: { success: false, error: 'Categoría inválida.' } })
  })

  it('removes a venue tip', async () => {
    vi.mocked(removeVenueTip).mockResolvedValue({})

    const body = await query('mutation { removeVenueTip(id: "tip-1") { success error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ removeVenueTip: { success: true, error: null } })
    expect(removeVenueTip).toHaveBeenCalledWith('tip-1')
  })
})

describe('Venue.tips', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves tips via the DataLoader, batched by venue id', async () => {
    vi.mocked(findVenueById).mockResolvedValue({
      id: 'v1', name: 'Niceto', city: null, country: null, address: null, lat: null, lng: null,
      events: [],
    })
    vi.mocked(listVenueTipsBatch).mockResolvedValue([[
      { id: 't1', venue_id: 'v1', category: 'cola', body: 'Llegá temprano', created_at: '2026-01-01T00:00:00Z' },
    ]])

    const body = await query('{ venue(id: "v1") { tips { id category body createdAt } } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      venue: {
        tips: [{ id: 't1', category: 'cola', body: 'Llegá temprano', createdAt: '2026-01-01T00:00:00Z' }],
      },
    })
    expect(listVenueTipsBatch).toHaveBeenCalledWith(['v1'])
  })
})
