import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { StatsData } from '@/src/domains/stats/data'

vi.mock('@/src/domains/stats/data', () => ({
  getPersonalStats: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}))

import { getPersonalStats } from '@/src/domains/stats/data'
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

const stats: StatsData = {
  totalShows: 5,
  showsAttended: 3,
  showsGoing: 1,
  showsInterested: 1,
  uniqueArtists: 4,
  uniqueVenues: 2,
  uniqueCities: ['CABA', 'Córdoba'],
  uniqueCountries: ['AR'],
  showsByYear: { '2025': 2, '2026': 3 },
  topArtists: [{ name: 'Bandalos Chinos', count: 2 }],
  topVenues: [{ name: 'Niceto', city: 'CABA', count: 2 }],
  averageRating: 4.5,
  totalRated: 3,
  rainyShows: 0,
  totalWithWeather: 0,
  recentActivity: [
    {
      id: 'e1',
      name: 'Show en Niceto',
      date: '2026-03-01',
      venueName: 'Niceto',
      venueCity: 'CABA',
      status: 'went',
      rating: 5,
    },
  ],
}

describe('stats GraphQL schema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves myStats end to end, including the JSON showsByYear map', async () => {
    vi.mocked(getPersonalStats).mockResolvedValue(stats)

    const body = await query(`{
      myStats {
        totalShows
        showsByYear
        topArtists { name count }
        topVenues { name city count }
        uniqueCities
        averageRating
        recentActivity { id name status rating }
      }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      myStats: {
        totalShows: 5,
        showsByYear: { '2025': 2, '2026': 3 },
        topArtists: [{ name: 'Bandalos Chinos', count: 2 }],
        topVenues: [{ name: 'Niceto', city: 'CABA', count: 2 }],
        uniqueCities: ['CABA', 'Córdoba'],
        averageRating: 4.5,
        recentActivity: [{ id: 'e1', name: 'Show en Niceto', status: 'went', rating: 5 }],
      },
    })
  })
})
