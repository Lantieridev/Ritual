import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EventWithAttendance } from '@/src/domains/events/service'

vi.mock('@/src/domains/events/service', () => ({
  insertEvent: vi.fn(),
  modifyEvent: vi.fn(),
  removeEvent: vi.fn(),
  addExternalEvent: vi.fn(),
  listEvents: vi.fn(),
  listEventsWithAttendance: vi.fn(),
  findEventById: vi.fn(),
  getAttendanceForEvent: vi.fn(),
  getAttendanceForEventsBatch: vi.fn(),
  getEventPhotos: vi.fn(),
  getEventPhotosBatch: vi.fn(),
  deleteEventPhoto: vi.fn(),
  getOrCreateAttendance: vi.fn(),
  setAttendanceStatus: vi.fn(),
  saveMemory: vi.fn(),
  getEventMessages: vi.fn(),
  addEventMessage: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    rpc: vi.fn().mockResolvedValue({ data: 'usuario', error: null })
  }),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue('u1'),
}))

import {
  insertEvent,
  modifyEvent,
  removeEvent,
  addExternalEvent,
  listEvents,
  listEventsWithAttendance,
  findEventById,
  getAttendanceForEvent,
  getAttendanceForEventsBatch,
  getEventPhotosBatch,
  deleteEventPhoto,
  getOrCreateAttendance,
  setAttendanceStatus,
  saveMemory,
  getEventMessages,
  addEventMessage,
} from '@/src/domains/events/service'
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
  ticket_url: 'https://allaccess.com.ar/e/1',
  venues: { name: 'Niceto', city: 'CABA', country: 'AR' },
  lineups: [{ artists: { id: 'a1', name: 'Bandalos Chinos', genre: 'Indie' }, is_headliner: true }],
}

describe('events GraphQL schema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves the plain events query with venue and lineup, no attendance call at all', async () => {
    vi.mocked(listEvents).mockResolvedValue([event])

    const body = await query('{ events { edges { node { id name venue { name city } lineups { artist { name } isHeadliner } } } } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      events: {
        edges: [
          {
            node: {
              id: 'e1',
              name: 'Show en Niceto',
              venue: { name: 'Niceto', city: 'CABA' },
              lineups: [{ artist: { name: 'Bandalos Chinos' }, isHeadliner: true }],
            }
          }
        ]
      },
    })
    expect(getAttendanceForEvent).not.toHaveBeenCalled()
  })

  // El link de entradas se carga a mano por evento (issue #19) y la ficha
  // dibuja el botón "Comprar entradas" con él — sin este campo un cliente
  // que no sea la web no tiene con qué dibujarlo.
  it('exposes the ticket link on an event', async () => {
    vi.mocked(findEventById).mockResolvedValue(event)

    const body = await query('{ event(id: "e1") { ticketUrl } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ event: { ticketUrl: 'https://allaccess.com.ar/e/1' } })
  })

  it('resolves eventsWithAttendance from the batched join, without calling getAttendanceForEvent per event (no N+1)', async () => {
    vi.mocked(listEventsWithAttendance).mockResolvedValue([
      {
        ...event,
        attendance: [{ id: 'att1', status: 'went', user_id: 'u1', rating: 5, review: null }],
      },
    ])

    const body = await query('{ eventsWithAttendance { edges { node { id attendance { status rating } } } } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      eventsWithAttendance: {
        edges: [
          {
            node: { id: 'e1', attendance: [{ status: 'went', rating: 5 }] }
          }
        ]
      },
    })
    expect(getAttendanceForEvent).not.toHaveBeenCalled()
  })

  it('resolves myAttendance and photos on a single event via the DataLoader batched queries', async () => {
    vi.mocked(findEventById).mockResolvedValue(event)
    vi.mocked(getAttendanceForEventsBatch).mockResolvedValue([{
      id: 'att1',
      status: 'went',
      rating: 5,
      review: 'Buenísimo',
      notes: null,
    }])
    vi.mocked(getEventPhotosBatch).mockResolvedValue([[
      { id: 'ph1', event_id: 'e1', storage_path: 'x.jpg', caption: 'Foto 1', created_at: '2026-03-02', url: 'https://x/x.jpg' },
    ]])

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
    expect(getAttendanceForEventsBatch).toHaveBeenCalledWith(['e1'], 'u1')
    expect(getEventPhotosBatch).toHaveBeenCalledWith(['e1'])
  })

  it('resolves event(id) as null when it does not exist', async () => {
    vi.mocked(findEventById).mockResolvedValue(null)

    const body = await query('{ event(id: "missing") { id } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ event: null })
  })

  it('resolves myAttendance as null when the user has no attendance for that event', async () => {
    vi.mocked(findEventById).mockResolvedValue(event)
    vi.mocked(getAttendanceForEventsBatch).mockResolvedValue([null])

    const body = await query('{ event(id: "e1") { myAttendance { status } } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ event: { myAttendance: null } })
  })

  it('resolves an event with no venue/lineup as nullable/empty, not an error', async () => {
    vi.mocked(listEvents).mockResolvedValue([
      { id: 'e2', name: null, date: '2026-04-01', venue_id: null, venues: null, lineups: null },
    ])

    const body = await query('{ events { edges { node { id name venue { name } lineups { artist { name } } } } } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      events: {
        edges: [
          {
            node: { id: 'e2', name: null, venue: null, lineups: [] }
          }
        ]
      }
    })
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
      ticket_url: undefined,
    })
  })

  it('carries the ticket link through createEvent', async () => {
    vi.mocked(insertEvent).mockResolvedValue({ id: 'e-new' })

    await query(`mutation {
      createEvent(input: { name: "Show", date: "2026-03-01", venueId: "v1", ticketUrl: "https://allaccess.com.ar/e/1" }) { id error }
    }`)

    expect(insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ ticket_url: 'https://allaccess.com.ar/e/1' })
    )
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
      ticket_url: undefined,
    })
  })

  // Mandar '' es cómo se borra el link: si el resolver lo mapeara por
  // truthiness llegaría como undefined y modifyEvent dejaría el link viejo.
  it('passes an empty ticket link through as an empty string, so it can be cleared', async () => {
    vi.mocked(modifyEvent).mockResolvedValue({})

    await query('mutation { updateEvent(id: "e1", input: { ticketUrl: "" }) { success error } }')

    expect(modifyEvent).toHaveBeenCalledWith('e1', expect.objectContaining({ ticket_url: '' }))
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
    const { getCurrentUserId } = await import('@/src/core/auth/session')
    vi.mocked(getCurrentUserId).mockResolvedValueOnce(null)
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

  it('sends an event message', async () => {
    vi.mocked(addEventMessage).mockResolvedValue({})

    const body = await query('mutation { sendEventMessage(eventId: "e1", body: "Nos vemos a las 20") { success error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ sendEventMessage: { success: true, error: null } })
    expect(addEventMessage).toHaveBeenCalledWith('e1', 'Nos vemos a las 20')
  })

  it('reports sendEventMessage failure through success:false', async () => {
    vi.mocked(addEventMessage).mockResolvedValue({ error: 'Necesitás marcar tu asistencia a este show para escribir acá.' })

    const body = await query('mutation { sendEventMessage(eventId: "e1", body: "hola") { success error } }')

    expect(body.data).toEqual({
      sendEventMessage: { success: false, error: 'Necesitás marcar tu asistencia a este show para escribir acá.' },
    })
  })
})

describe('eventMessages query', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves the thread for an event', async () => {
    vi.mocked(getEventMessages).mockResolvedValue([
      { id: 'm1', user_id: 'u1', body: 'Nos vemos en la puerta', created_at: '2026-01-01T00:00:00Z', author_username: 'martin' },
    ])

    const body = await query('{ eventMessages(eventId: "e1") { id body authorUsername createdAt } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      eventMessages: [{ id: 'm1', body: 'Nos vemos en la puerta', authorUsername: 'martin', createdAt: '2026-01-01T00:00:00Z' }],
    })
    expect(getEventMessages).toHaveBeenCalledWith('e1')
  })

  it('authorUsername is null when the profile has none', async () => {
    vi.mocked(getEventMessages).mockResolvedValue([
      { id: 'm1', user_id: 'u2', body: 'Dale', created_at: '2026-01-01T00:00:00Z', author_username: null },
    ])

    const body = await query('{ eventMessages(eventId: "e1") { authorUsername } }')

    expect(body.data).toEqual({ eventMessages: [{ authorUsername: null }] })
  })

  it(
    'isOwn se resuelve contra el user_id real del caller, no contra authorUsername ' +
      '(un perfil sin username nunca podría reconocer sus propios mensajes por nombre)',
    async () => {
      // getCurrentUserId mockeado a 'u1' por default en este archivo (línea ~31).
      vi.mocked(getEventMessages).mockResolvedValue([
        { id: 'm1', user_id: 'u1', body: 'Mensaje propio', created_at: '2026-01-01T00:00:00Z', author_username: null },
        { id: 'm2', user_id: 'u2', body: 'Mensaje ajeno', created_at: '2026-01-01T00:00:01Z', author_username: null },
      ])

      const body = await query('{ eventMessages(eventId: "e1") { id isOwn } }')

      expect(body.errors).toBeUndefined()
      expect(body.data).toEqual({
        eventMessages: [
          { id: 'm1', isOwn: true },
          { id: 'm2', isOwn: false },
        ],
      })
    }
  )

  it('isOwn es false para cualquier mensaje si no hay sesión', async () => {
    const { getCurrentUserId } = await import('@/src/core/auth/session')
    vi.mocked(getCurrentUserId).mockResolvedValueOnce(null)
    vi.mocked(getEventMessages).mockResolvedValue([
      { id: 'm1', user_id: 'u1', body: 'Mensaje', created_at: '2026-01-01T00:00:00Z', author_username: null },
    ])

    const body = await query('{ eventMessages(eventId: "e1") { isOwn } }')

    expect(body.data).toEqual({ eventMessages: [{ isOwn: false }] })
  })
})
