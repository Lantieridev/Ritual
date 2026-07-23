import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Festival } from '@/src/domains/festivals/data'

vi.mock('@/src/domains/festivals/data', () => ({
  getFestivals: vi.fn(),
  getFestivalById: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}))

import { getFestivals, getFestivalById } from '@/src/domains/festivals/data'

async function query(source: string) {
  const { POST } = await import('@/app/api/graphql/route')
  const response = await POST(
    new Request('http://localhost/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: source }),
    })
  )
  return response.json()
}

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
  festival_events: [
    {
      id: 'fe1',
      day_label: 'Día 1',
      events: {
        id: 'e1',
        name: 'Show día 1',
        date: '2026-02-01',
        lineups: [{ artists: { id: 'a1', name: 'Bandalos Chinos' } }],
      },
    },
  ],
  festival_attendance: [{ status: 'going', rating: null, review: null }],
}

describe('festivals GraphQL schema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves the nested festival shape end to end', async () => {
    vi.mocked(getFestivals).mockResolvedValue([festival])

    const body = await query(`{
      festivals {
        id
        name
        startDate
        venue { name city }
        festivalEvents {
          dayLabel
          event {
            name
            lineups { artist { name } }
          }
        }
        festivalAttendance { status }
      }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      festivals: [
        {
          id: 'f1',
          name: 'Cosquín Rock',
          startDate: '2026-02-01',
          venue: { name: 'Aeródromo', city: 'Santa María de Punilla' },
          festivalEvents: [
            {
              dayLabel: 'Día 1',
              event: {
                name: 'Show día 1',
                lineups: [{ artist: { name: 'Bandalos Chinos' } }],
              },
            },
          ],
          festivalAttendance: [{ status: 'going' }],
        },
      ],
    })
  })

  it('resolves a single festival by id, null when it does not exist', async () => {
    vi.mocked(getFestivalById).mockResolvedValue(null)

    const body = await query('{ festival(id: "missing") { id } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ festival: null })
    expect(getFestivalById).toHaveBeenCalledWith('missing')
  })
})
