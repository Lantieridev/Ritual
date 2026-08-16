import { describe, it, expect, vi, beforeEach } from 'vitest'

const geocodeCity = vi.fn()

vi.mock('@/src/core/lib/nominatim', () => ({
  geocodeCity: (...args: unknown[]) => geocodeCity(...args),
}))

import { syncCityCoordinates } from '@/src/domains/taste/syncCityCoordinates'

function makeSupabase() {
  const update = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  return { from: vi.fn(() => ({ update })), update }
}

describe('syncCityCoordinates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('geocodes the city and persists lat/lng on the profile', async () => {
    geocodeCity.mockResolvedValue({ lat: -34.6, lng: -58.4 })
    const supabase = makeSupabase()

    await syncCityCoordinates(supabase as never, 'u1', 'Buenos Aires, Argentina')

    expect(geocodeCity).toHaveBeenCalledWith('Buenos Aires, Argentina')
    expect(supabase.update).toHaveBeenCalledWith({ city_lat: -34.6, city_lng: -58.4 })
  })

  it('leaves the coordinates untouched, without throwing, when geocoding fails', async () => {
    geocodeCity.mockResolvedValue({ lat: null, lng: null, error: 'Nominatim tardó demasiado en responder.' })
    const supabase = makeSupabase()

    await expect(syncCityCoordinates(supabase as never, 'u1', 'Somewhere unknown')).resolves.not.toThrow()
    expect(supabase.update).not.toHaveBeenCalled()
  })
})
