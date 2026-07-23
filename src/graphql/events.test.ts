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
  deleteEventPhoto: vi.fn(),
}))

vi.mock('@/src/domains/events/actions', () => ({
  insertEvent: vi.fn(),
  modifyEvent: vi.fn(),
  removeEvent: vi.fn(),
  addExternalEvent: vi.fn(),
}))

vi.mock('@/src/domains/events/attendance-actions', () => ({
  getOrCreateAttendance: vi.fn(),
  setAttendanceStatus: vi.fn(),
  saveMemory: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}))

import { getEvents, getEventsWithAttendance, getEventById } from '@/src/domains/events/data'
import { getAttendanceForEvent } from '@/src/domains/events/attendance-data'
import { getEventPhotos, deleteEventPhoto } from '@/src/domains/events/photo-actions'
import { insertEvent, modifyEvent, removeEvent, addExternalEvent } from '@/src/domains/events/actions'
import { getOrCreateAttendance, setAttendanceStatus, saveMemory } from '@/src/domains/events/attendance-actions'
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

describe('events GraphQL mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an event, mapping camelCase input to the domain snake_case shape', async () => {
    vi.mocked(insertEvent).mockResolvedValue({ id: 'e-new' })

    const body = await query(`mutation {
      createEvent(input: { name: "Show", date: "2026-03-01", venueId: "v1", artistIds: ["a1", "a2"] }) { id error }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ createEvent: { id: 'e-new', error: null } })
    expect(insertEvent).toHaveBeenCalledWith({
      name: 'Show',
      date: '2026-03-01',
      venue_id: 'v1',
      artist_ids: ['a1', 'a2'],
    })
  })

  it('updates an event', async () => {
    vi.mocked(modifyEvent).mockResolvedValue({})

    const body = await query('mutation { updateEvent(id: "e1", input: { name: "Nuevo nombre" }) { success error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ updateEvent: { success: true, error: null } })
    expect(modifyEvent).toHaveBeenCalledWith('e1', {
      name: 'Nuevo nombre',
      date: undefined,
      venue_id: undefined,
      artist_ids: undefined,
    })
  })

  it('deletes an event', async () => {
    vi.mocked(removeEvent).mockResolvedValue({})

    const body = await query('mutation { deleteEvent(id: "e1") { success error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ deleteEvent: { success: true, error: null } })
    expect(removeEvent).toHaveBeenCalledWith('e1')
  })

  it('adds an external event, building only the fields addExternalEvent actually reads', async () => {
    vi.mocked(addExternalEvent).mockResolvedValue({ eventId: 'e-new' })

    const body = await query(`mutation {
      addExternalEvent(
        input: { title: "Show en Niceto", datetime: "2026-03-01T21:00:00Z", venue: { name: "Niceto", city: "CABA" }, lineup: ["Bandalos Chinos"] }
        notes: "1. Cumbia Rara"
      ) { eventId error }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ addExternalEvent: { eventId: 'e-new', error: null } })
    expect(addExternalEvent).toHaveBeenCalledWith(
      {
        id: '',
        title: 'Show en Niceto',
        datetime: '2026-03-01T21:00:00Z',
        venue: { name: 'Niceto', city: 'CABA', country: undefined },
        lineup: ['Bandalos Chinos'],
      },
      undefined,
      '1. Cumbia Rara'
    )
  })

  it('gets or creates attendance, filling the fields the function never selects as null', async () => {
    vi.mocked(getOrCreateAttendance).mockResolvedValue({ id: 'att1', status: 'interested' })

    const body = await query('mutation { getOrCreateAttendance(eventId: "e1") { id status rating review notes } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      getOrCreateAttendance: { id: 'att1', status: 'interested', rating: null, review: null, notes: null },
    })
  })

  it('returns null from getOrCreateAttendance when there is no session', async () => {
    vi.mocked(getOrCreateAttendance).mockResolvedValue(null)

    const body = await query('mutation { getOrCreateAttendance(eventId: "e1") { id } }')

    expect(body.data).toEqual({ getOrCreateAttendance: null })
  })

  it('sets the attendance status using the shared enum', async () => {
    vi.mocked(setAttendanceStatus).mockResolvedValue({})

    const body = await query('mutation { setAttendanceStatus(eventId: "e1", status: went) { success } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ setAttendanceStatus: { success: true } })
    expect(setAttendanceStatus).toHaveBeenCalledWith('e1', 'went')
  })

  it('deletes an event photo', async () => {
    vi.mocked(deleteEventPhoto).mockResolvedValue({})

    const body = await query('mutation { deleteEventPhoto(photoId: "ph1", eventId: "e1") { success error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ deleteEventPhoto: { success: true, error: null } })
    expect(deleteEventPhoto).toHaveBeenCalledWith('ph1', 'e1')
  })

  it('saves rating/review/notes via saveMemory', async () => {
    vi.mocked(saveMemory).mockResolvedValue({})

    const body = await query(
      'mutation { saveMemory(eventId: "e1", rating: 5, review: "Genial") { success } }'
    )

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ saveMemory: { success: true } })
    expect(saveMemory).toHaveBeenCalledWith('e1', { rating: 5, review: 'Genial', notes: undefined })
  })
})
