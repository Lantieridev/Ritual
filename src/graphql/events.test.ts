import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EventWithAttendance } from '@/src/domains/events/data'

vi.mock('@/src/domains/events/data', () => ({
  getEvents: vi.fn(),
  getEventsWithAttendance: vi.fn(),
  getEventById: vi.fn(),
}))

vi.mock('@/src/domains/events/attendance-data', () => ({
  getAttendanceForEvent: vi.fn(),
}))

vi.mock('@/src/domains/events/photo-actions', () => ({
  getEventPhotos: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}))

import { getEvents, getEventsWithAttendance, getEventById } from '@/src/domains/events/data'
import { getAttendanceForEvent } from '@/src/domains/events/attendance-data'
import { getEventPhotos } from '@/src/domains/events/photo-actions'
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

const event: EventWithAttendance = {
  id: 'e1',
  name: 'Show en Niceto',
  date: '2026-03-01',
  venue_id: 'v1',
  status: 'confirmed',
  created_at: '2026-01-01T00:00:00Z',
  venues: { name: 'Niceto', city: 'CABA', country: 'AR' },
  lineups: [{ artists: { id: 'a1', name: 'Bandalos Chinos', genre: 'Indie' }, is_headliner: true }],
}

describe('events GraphQL schema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves the plain events query with venue and lineup, no attendance call at all', async () => {
    vi.mocked(getEvents).mockResolvedValue([event])

    const body = await query('{ events { id name venue { name city } lineups { artist { name } isHeadliner } } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      events: [
        {
          id: 'e1',
          name: 'Show en Niceto',
          venue: { name: 'Niceto', city: 'CABA' },
          lineups: [{ artist: { name: 'Bandalos Chinos' }, isHeadliner: true }],
        },
      ],
    })
    expect(getAttendanceForEvent).not.toHaveBeenCalled()
  })

  it('resolves eventsWithAttendance from the batched join, without calling getAttendanceForEvent per event (no N+1)', async () => {
    vi.mocked(getEventsWithAttendance).mockResolvedValue([
      {
        ...event,
        attendance: [{ id: 'att1', status: 'went', user_id: 'u1', rating: 5, review: null }],
      },
    ])

    const body = await query('{ eventsWithAttendance { id attendance { status rating } } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      eventsWithAttendance: [{ id: 'e1', attendance: [{ status: 'went', rating: 5 }] }],
    })
    expect(getAttendanceForEvent).not.toHaveBeenCalled()
  })

  it('resolves myAttendance and photos on a single event via their own per-event query', async () => {
    vi.mocked(getEventById).mockResolvedValue(event)
    vi.mocked(getAttendanceForEvent).mockResolvedValue({
      id: 'att1',
      status: 'went',
      rating: 5,
      review: 'Buenísimo',
      notes: null,
    })
    vi.mocked(getEventPhotos).mockResolvedValue([
      { id: 'ph1', event_id: 'e1', storage_path: 'x.jpg', caption: 'Foto 1', created_at: '2026-03-02', url: 'https://x/x.jpg' },
    ])

    const body = await query(`{
      event(id: "e1") {
        id
        myAttendance { status rating review }
        photos { id caption url }
      }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      event: {
        id: 'e1',
        myAttendance: { status: 'went', rating: 5, review: 'Buenísimo' },
        photos: [{ id: 'ph1', caption: 'Foto 1', url: 'https://x/x.jpg' }],
      },
    })
    expect(getAttendanceForEvent).toHaveBeenCalledWith('e1')
    expect(getEventPhotos).toHaveBeenCalledWith('e1')
  })

  it('resolves event(id) as null when it does not exist', async () => {
    vi.mocked(getEventById).mockResolvedValue(null)

    const body = await query('{ event(id: "missing") { id } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ event: null })
  })

  it('resolves myAttendance as null when the user has no attendance for that event', async () => {
    vi.mocked(getEventById).mockResolvedValue(event)
    vi.mocked(getAttendanceForEvent).mockResolvedValue(null)

    const body = await query('{ event(id: "e1") { myAttendance { status } } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ event: { myAttendance: null } })
  })

  it('resolves an event with no venue/lineup as nullable/empty, not an error', async () => {
    vi.mocked(getEvents).mockResolvedValue([
      { id: 'e2', name: null, date: '2026-04-01', venue_id: null, venues: null, lineups: null },
    ])

    const body = await query('{ events { id name venue { name } lineups { artist { name } } } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ events: [{ id: 'e2', name: null, venue: null, lineups: [] }] })
  })
})
