import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

vi.mock('@/src/domains/venues/data', () => ({
  getVenues: vi.fn(),
  getVenueById: vi.fn(),
}))

/**
 * Nominatim se mockea siempre: sin esto el alta de sede sale a internet de
 * verdad en cada corrida de la suite, lo que la vuelve lenta, dependiente de
 * un tercero y de resultado distinto según haya red.
 */
vi.mock('@/src/core/lib/nominatim', () => ({
  geocodeVenue: vi.fn().mockResolvedValue({ lat: null, lng: null }),
}))

import { listVenues, findVenueById, insertVenue, findOrCreateVenue } from '@/src/domains/venues/service'
import { getVenues, getVenueById } from '@/src/domains/venues/data'
import { getCurrentUserId } from '@/src/core/auth/session'
import { geocodeVenue } from '@/src/core/lib/nominatim'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  builder.insert = vi.fn(() => builder)
  builder.select = vi.fn(() => builder)
  builder.single = vi.fn(() => Promise.resolve(result))
  return builder
}

function makeLookupBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.ilike = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.limit = vi.fn(chain)
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  builder.single = vi.fn(() => Promise.resolve(result))
  return builder
}

describe('listVenues / findVenueById', () => {
  beforeEach(() => vi.clearAllMocks())

  it('delegates the catalog read to the data layer', async () => {
    vi.mocked(getVenues).mockResolvedValue([{ id: 'v-1', name: 'Niceto Club' }])
    await expect(listVenues()).resolves.toEqual([{ id: 'v-1', name: 'Niceto Club' }])
  })

  it('delegates the detail read to the data layer', async () => {
    vi.mocked(getVenueById).mockResolvedValue(null)
    await expect(findVenueById('v-1')).resolves.toBeNull()
    expect(getVenueById).toHaveBeenCalledWith('v-1')
  })
})

describe('insertVenue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('rejects an unauthenticated caller', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await insertVenue({ name: 'Niceto Club' })
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects a missing or whitespace-only name without touching the database', async () => {
    const result = await insertVenue({ name: '   ' })

    expect(result).toEqual({ error: 'El nombre de la sede es obligatorio.' })
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('trims and inserts optional fields, returning the new id', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: { id: 'v-new' }, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await insertVenue({
      name: '  Niceto Club  ',
      city: '  CABA  ',
      address: '  Cordoba 5500  ',
      country: '  Argentina  ',
    })

    const builder = fromMock.mock.results[0].value as { insert: ReturnType<typeof vi.fn> }
    expect(builder.insert).toHaveBeenCalledWith({
      name: 'Niceto Club',
      city: 'CABA',
      address: 'Cordoba 5500',
      country: 'Argentina',
      lat: null,
      lng: null,
    })
    expect(result).toEqual({ id: 'v-new' })
  })

  it('geocodifica la sede y guarda las coordenadas — de eso depende el clima del show', async () => {
    vi.mocked(geocodeVenue).mockResolvedValue({ lat: -34.5874, lng: -58.43891 })
    const fromMock = vi.fn(() => makeQueryBuilder({ data: { id: 'v-new' }, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    await insertVenue({ name: 'Niceto Club', city: 'CABA', address: 'Cordoba 5500', country: 'AR' })

    expect(geocodeVenue).toHaveBeenCalledWith({
      name: 'Niceto Club',
      address: 'Cordoba 5500',
      city: 'CABA',
      country: 'AR',
    })
    const builder = fromMock.mock.results[0].value as { insert: ReturnType<typeof vi.fn> }
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ lat: -34.5874, lng: -58.43891 })
    )
  })

  // El ADR 0003 manda: un servicio externo caído no bloquea una acción propia.
  it('crea la sede igual cuando la geocodificación falla', async () => {
    vi.mocked(geocodeVenue).mockResolvedValue({ lat: null, lng: null, error: 'Nominatim caído' })
    const fromMock = vi.fn(() => makeQueryBuilder({ data: { id: 'v-new' }, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await insertVenue({ name: 'Niceto Club' })

    expect(result).toEqual({ id: 'v-new' })
  })

  it('truncates a name longer than 200 characters', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: { id: 'v-new' }, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))
    const longName = 'A'.repeat(250)

    await insertVenue({ name: longName })

    const builder = fromMock.mock.results[0].value as { insert: ReturnType<typeof vi.fn> }
    const inserted = builder.insert.mock.calls[0][0] as { name: string }
    expect(inserted.name).toHaveLength(200)
  })

  it('returns a sanitized error message when the insert fails, never the raw DB message', async () => {
    const fromMock = vi.fn(() =>
      makeQueryBuilder({ data: null, error: { message: 'duplicate key value violates unique constraint' } })
    )
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await insertVenue({ name: 'Niceto Club' })

    expect(result?.error).toBe('Ya existe un registro con esos datos.')
  })

  // A name-collision used to dead-end on the same generic message as any
  // other DB error — now it looks up the existing row so the form can link
  // straight to it instead of leaving the user stuck.
  it('looks up and returns the existing venue id on a name collision', async () => {
    const insertBuilder = makeQueryBuilder({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint "venues_name_key_unique"' },
    })
    const lookupBuilder = makeLookupBuilder({ data: { id: 'existing-venue-1' }, error: null })
    let callCount = 0
    const fromMock = vi.fn(() => {
      callCount++
      return callCount === 1 ? insertBuilder : lookupBuilder
    })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await insertVenue({ name: 'Niceto Club' })

    expect(lookupBuilder.ilike).toHaveBeenCalledWith('name', 'Niceto Club')
    expect(result).toEqual({ error: 'Ya existe una sede con ese nombre.', existingId: 'existing-venue-1' })
  })
})

describe('findOrCreateVenue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('rejects an unauthenticated caller', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await findOrCreateVenue('Niceto Club')
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects a whitespace-only name without touching the database', async () => {
    const result = await findOrCreateVenue('   ')
    expect(result).toEqual({ error: 'El nombre de la sede es obligatorio.' })
    expect(mockCreateClient).not.toHaveBeenCalled()
  })
})
