import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./data', () => ({
  getFestivals: vi.fn(),
  getFestivalById: vi.fn(),
}))

import { getFestivals, getFestivalById } from './data'
import type { Festival } from './data'
import { listFestivals, findFestivalById } from './service'

/**
 * This service is the seam introduced for issue #25: Server Components and
 * the GraphQL resolver call these functions instead of importing ./data
 * directly. These tests only need to prove each use case delegates to the
 * right data-layer call with the right arguments — the actual Supabase
 * behavior is already covered by data.test.ts.
 */
describe('festivals service (use-case layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const festival: Festival = {
    id: 'f1',
    name: 'Cosquín Rock',
    edition: '2026',
    start_date: '2026-02-01',
    end_date: '2026-02-03',
    venue_id: 'v1',
    city: 'Córdoba',
    country: 'AR',
    website: null,
    poster_url: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    venues: { name: 'Aeródromo', city: 'Santa María de Punilla' },
    festival_events: [],
    festival_attendance: [],
  }

  it('listFestivals delegates to getFestivals with no arguments', async () => {
    vi.mocked(getFestivals).mockResolvedValue([festival])

    const result = await listFestivals()

    expect(getFestivals).toHaveBeenCalledWith()
    expect(result).toEqual([festival])
  })

  it('findFestivalById delegates to getFestivalById with the given id', async () => {
    vi.mocked(getFestivalById).mockResolvedValue(festival)

    const result = await findFestivalById('f1')

    expect(getFestivalById).toHaveBeenCalledWith('f1')
    expect(result).toBe(festival)
  })

  it('findFestivalById returns null when the festival does not exist', async () => {
    vi.mocked(getFestivalById).mockResolvedValue(null)

    const result = await findFestivalById('missing')

    expect(result).toBeNull()
  })
})
