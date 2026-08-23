import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Festival } from '@/src/domains/festivals/data'

vi.mock('@/src/domains/festivals/service', () => ({
  listFestivals: vi.fn(),
  findFestivalById: vi.fn(),
  insertFestival: vi.fn(),
  removeFestival: vi.fn(),
  saveFestivalAttendance: vi.fn(),
  linkEventToFestival: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}))

import {
  listFestivals,
  findFestivalById,
  insertFestival,
  removeFestival,
  saveFestivalAttendance,
  linkEventToFestival,
} from '@/src/domains/festivals/service'
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
        lineups: [{ artists: { id: 'a1', name: 'Bandalos Chinos' }, stage: null, start_time: null }],
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
    vi.mocked(listFestivals).mockResolvedValue([festival])

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
    vi.mocked(findFestivalById).mockResolvedValue(null)

    const body = await query('{ festival(id: "missing") { id } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ festival: null })
    expect(findFestivalById).toHaveBeenCalledWith('missing')
  })
})

describe('festivals GraphQL mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a festival, mapping camelCase input to the domain snake_case shape', async () => {
    vi.mocked(insertFestival).mockResolvedValue({ id: 'f-new' })

    const body = await query(`mutation {
      createFestival(input: { name: "Cosquín Rock", startDate: "2026-02-01" }) { id error }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ createFestival: { id: 'f-new', error: null } })
    expect(insertFestival).toHaveBeenCalledWith({
      name: 'Cosquín Rock',
      edition: undefined,
      start_date: '2026-02-01',
      end_date: undefined,
      city: undefined,
      country: undefined,
      website: undefined,
      notes: undefined,
    })
  })

  it('deletes a festival, translating ActionResult into {success, error}', async () => {
    vi.mocked(removeFestival).mockResolvedValue({})

    const body = await query('mutation { deleteFestival(id: "f1") { success error } }')

    expect(body.data).toEqual({ deleteFestival: { success: true, error: null } })
    expect(removeFestival).toHaveBeenCalledWith('f1')
  })

  it('reports failure through success:false, not a thrown GraphQL error', async () => {
    vi.mocked(removeFestival).mockResolvedValue({ error: 'boom' })

    const body = await query('mutation { deleteFestival(id: "f1") { success error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ deleteFestival: { success: false, error: 'boom' } })
  })

  it('saves festival attendance using the shared AttendanceStatus enum', async () => {
    vi.mocked(saveFestivalAttendance).mockResolvedValue({})

    const body = await query(
      'mutation { saveFestivalAttendance(festivalId: "f1", status: went, rating: 5) { success } }'
    )

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ saveFestivalAttendance: { success: true } })
    expect(saveFestivalAttendance).toHaveBeenCalledWith('f1', 'went', 5, undefined)
  })

  it('links an event to a festival', async () => {
    vi.mocked(linkEventToFestival).mockResolvedValue({})

    const body = await query(
      'mutation { linkEventToFestival(festivalId: "f1", eventId: "e1", dayLabel: "Día 1") { success } }'
    )

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ linkEventToFestival: { success: true } })
    expect(linkEventToFestival).toHaveBeenCalledWith('f1', 'e1', 'Día 1')
  })
})

describe('festivals GraphQL parity additions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Regresion de paridad: el detalle ordena el lineup por horario y muestra
  // el escenario, pero stage/start_time no estaban expuestos en el schema.
  it('exposes stage and start time on each lineup entry', async () => {
    vi.mocked(findFestivalById).mockResolvedValue({
      ...festival,
      festival_events: [
        {
          id: 'fe1',
          day_label: 'Dia 1',
          events: {
            id: 'e1',
            name: 'Dia 1',
            date: '2026-01-01',
            lineups: [
              { artists: { id: 'a1', name: 'Bandalos Chinos' }, stage: 'Escenario Norte', start_time: '21:30' },
            ],
          },
        },
      ],
    })

    const body = await query(`{
      festival(id: "f1") {
        festivalEvents { event { lineups { artist { name } stage startTime } } }
      }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data.festival.festivalEvents[0].event.lineups).toEqual([
      { artist: { name: 'Bandalos Chinos' }, stage: 'Escenario Norte', startTime: '21:30' },
    ])
  })
})
