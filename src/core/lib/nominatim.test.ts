import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { geocodeVenue, geocodeCity } from '@/src/core/lib/nominatim'

describe('geocodeVenue', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null coordinates without fetching when the venue has no usable query text', async () => {
    const result = await geocodeVenue({ name: '', address: null, city: null })

    expect(result).toEqual({ lat: null, lng: null })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns coordinates on a successful match', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ lat: '-34.5874', lon: '-58.43891' }]),
    } as Response)

    const result = await geocodeVenue({ name: 'Niceto Club', city: 'Buenos Aires', country: 'AR' })

    expect(result).toEqual({ lat: -34.5874, lng: -58.43891 })
  })

  it('scopes the query to a 2-letter country code when present', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ lat: '-34.5874', lon: '-58.43891' }]),
    } as Response)

    await geocodeVenue({ name: 'Niceto Club', country: 'AR' })

    const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as string
    expect(calledUrl).toContain('countrycodes=ar')
  })

  it('does not scope the query when the country code is missing or malformed', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response)

    await geocodeVenue({ name: 'Niceto Club', country: 'Argentina' })

    const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as string
    expect(calledUrl).not.toContain('countrycodes')
  })

  it('returns null coordinates when Nominatim finds no place', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response)

    const result = await geocodeVenue({ name: 'Un lugar inexistente' })

    expect(result).toEqual({ lat: null, lng: null })
  })

  it('returns null coordinates when the match has an unparseable/out-of-range coordinate', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ lat: 'not-a-number', lon: '-58.43891' }]),
    } as Response)

    const result = await geocodeVenue({ name: 'Niceto Club' })

    expect(result).toEqual({ lat: null, lng: null })
  })

  it('returns an error message on a non-ok HTTP response', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 503 } as Response)

    const result = await geocodeVenue({ name: 'Niceto Club' })

    expect(result).toEqual({ lat: null, lng: null, error: 'Nominatim respondió con error 503.' })
  })

  it('returns a timeout-specific error when the request aborts', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    const result = await geocodeVenue({ name: 'Niceto Club' })

    expect(result).toEqual({ lat: null, lng: null, error: 'Nominatim tardó demasiado en responder.' })
  })

  it('returns a generic error when fetch throws for another reason', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network down'))

    const result = await geocodeVenue({ name: 'Niceto Club' })

    expect(result).toEqual({ lat: null, lng: null, error: 'Error al conectar con Nominatim.' })
  })
})

describe('geocodeCity', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns coordinates for a valid city name', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ lat: '-31.4201', lon: '-64.1888' }]),
    } as Response)

    const result = await geocodeCity('Córdoba, Argentina')

    expect(result).toEqual({ lat: -31.4201, lng: -64.1888 })
  })

  it('never throws and degrades to null coordinates when Nominatim is unreachable', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network down'))

    const result = await geocodeCity('Ciudad inexistente')

    expect(result).toEqual({ lat: null, lng: null, error: 'Error al conectar con Nominatim.' })
  })

  it('degrades gracefully on timeout without throwing', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    const result = await geocodeCity('Ciudad lenta', 100)

    expect(result).toEqual({ lat: null, lng: null, error: 'Nominatim tardó demasiado en responder.' })
  })
})
