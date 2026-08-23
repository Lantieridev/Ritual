import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()
const mockRedirect = vi.fn()
const mockFindOrCreateByName = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}))

vi.mock('@/src/core/lib/find-or-create', () => ({
  findOrCreateByName: (...args: unknown[]) => mockFindOrCreateByName(...args),
}))

import {
  createEvent,
  addExternalEvent,
  updateEvent,
  deleteEvent,
  insertEvent,
  modifyEvent,
  removeEvent,
} from '@/src/domains/events/actions'
import { getCurrentUserId } from '@/src/core/auth/session'
import type { FutureEvent } from '@/src/core/types'

const VALID_VENUE_ID = '11111111-1111-1111-1111-111111111111'
const VALID_EVENT_ID = '22222222-2222-2222-2222-222222222222'
const VALID_ARTIST_ID = '33333333-3333-3333-3333-333333333333'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.insert = vi.fn(chain)
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.delete = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

describe('createEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('rejects an unauthenticated caller', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await createEvent({ name: 'Show', date: '2024-01-01', venue_id: VALID_VENUE_ID } as never)
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects a missing name, date, or venue', async () => {
    const noName = await createEvent({ name: '', date: '2024-01-01', venue_id: VALID_VENUE_ID } as never)
    expect(noName.error).toBeTruthy()

    const noDate = await createEvent({ name: 'Show', date: '', venue_id: VALID_VENUE_ID } as never)
    expect(noDate.error).toBeTruthy()

    const noVenue = await createEvent({ name: 'Show', date: '2024-01-01', venue_id: '' } as never)
    expect(noVenue.error).toBeTruthy()

    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects an invalid artist id in the lineup without inserting lineups', async () => {
    const eventsBuilder = makeQueryBuilder({ data: { id: VALID_EVENT_ID }, error: null })
    const lineupsBuilder = makeQueryBuilder({ data: null, error: null })
    const fromMock = vi.fn((table: string) => (table === 'events' ? eventsBuilder : lineupsBuilder))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await createEvent({
      name: 'Show',
      date: '2024-01-01',
      venue_id: VALID_VENUE_ID,
      artist_ids: ['not-a-uuid'],
    } as never)

    expect(result).toEqual({ error: 'ID de artista inválido.' })
    expect(lineupsBuilder.insert).not.toHaveBeenCalled()
  })

  it('creates the event, inserts lineups, and redirects home', async () => {
    const eventsBuilder = makeQueryBuilder({ data: { id: VALID_EVENT_ID }, error: null })
    const lineupsBuilder = makeQueryBuilder({ data: null, error: null })
    const fromMock = vi.fn((table: string) => (table === 'events' ? eventsBuilder : lineupsBuilder))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    await createEvent({
      name: 'Show',
      date: '2024-01-01',
      venue_id: VALID_VENUE_ID,
      artist_ids: [VALID_ARTIST_ID],
    } as never)

    expect(lineupsBuilder.insert).toHaveBeenCalledWith([
      { event_id: VALID_EVENT_ID, artist_id: VALID_ARTIST_ID },
    ])
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })

  // The event used to redirect as if everything succeeded even when the
  // lineup insert silently failed, losing the artist link with no
  // indication anything went wrong.
  it('returns an error and does not redirect when the lineup insert fails', async () => {
    const eventsBuilder = makeQueryBuilder({ data: { id: VALID_EVENT_ID }, error: null })
    const lineupsBuilder = makeQueryBuilder({ data: null, error: { message: 'boom' } })
    const fromMock = vi.fn((table: string) => (table === 'events' ? eventsBuilder : lineupsBuilder))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await createEvent({
      name: 'Show',
      date: '2024-01-01',
      venue_id: VALID_VENUE_ID,
      artist_ids: [VALID_ARTIST_ID],
    } as never)

    expect(result.error).toBeTruthy()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('rejects an unparseable date', async () => {
    const result = await createEvent({
      name: 'Show',
      date: 'not-a-date',
      venue_id: VALID_VENUE_ID,
    } as never)
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })
})

describe('addExternalEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  const baseEvent: FutureEvent = {
    title: 'Show en Niceto',
    datetime: '2024-05-01T20:00:00Z',
    venue: { name: 'Niceto Club', city: 'CABA', country: 'AR' },
    lineup: ['Bandalos Chinos'],
  } as FutureEvent

  it('rejects an unauthenticated caller', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await addExternalEvent(baseEvent)
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects an event with no venue', async () => {
    const result = await addExternalEvent({ ...baseEvent, venue: null } as never)
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects an event with no date', async () => {
    const result = await addExternalEvent({ ...baseEvent, datetime: '' } as never)
    expect(result.error).toBeTruthy()
  })

  it(
    'finds-or-creates the venue and artist through the shared helper, ' +
      'then links the lineup and returns the new event id without redirecting',
    async () => {
      mockFindOrCreateByName
        .mockResolvedValueOnce({ id: VALID_VENUE_ID })
        .mockResolvedValueOnce({ id: VALID_ARTIST_ID })

      const eventsBuilder = makeQueryBuilder({ data: { id: VALID_EVENT_ID }, error: null })
      const lineupsBuilder = makeQueryBuilder({ data: null, error: null })
      const fromMock = vi.fn((table: string) => (table === 'events' ? eventsBuilder : lineupsBuilder))
      mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

      const result = await addExternalEvent(baseEvent)

      expect(mockFindOrCreateByName).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        'venues',
        'Niceto Club',
        { city: 'CABA', country: 'AR' }
      )
      expect(mockFindOrCreateByName).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        'artists',
        'Bandalos Chinos'
      )
      expect(eventsBuilder.insert).toHaveBeenCalledWith({
        name: 'Show en Niceto',
        date: '2024-05-01T20:00:00Z',
        venue_id: VALID_VENUE_ID,
      })
      expect(lineupsBuilder.insert).toHaveBeenCalledWith({
        event_id: VALID_EVENT_ID,
        artist_id: VALID_ARTIST_ID,
      })
      expect(result).toEqual({ eventId: VALID_EVENT_ID })
      expect(mockRedirect).not.toHaveBeenCalled()
    }
  )

  // The caller used to get back `{ eventId }` with no `error` even when the
  // lineup insert failed, so the UI navigated straight to the new event as
  // if the artist link had been saved.
  it('returns an error alongside the event id when the lineup insert fails', async () => {
    mockFindOrCreateByName
      .mockResolvedValueOnce({ id: VALID_VENUE_ID })
      .mockResolvedValueOnce({ id: VALID_ARTIST_ID })

    const eventsBuilder = makeQueryBuilder({ data: { id: VALID_EVENT_ID }, error: null })
    const lineupsBuilder = makeQueryBuilder({ data: null, error: { message: 'boom' } })
    const fromMock = vi.fn((table: string) => (table === 'events' ? eventsBuilder : lineupsBuilder))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await addExternalEvent(baseEvent)

    expect(result.error).toBeTruthy()
    expect(result.eventId).toBe(VALID_EVENT_ID)
  })

  // Setlist.fm imports pass the real setlist as `notes` so it doesn't get
  // discarded — persisted by creating the attendance row directly in 'went'
  // (a setlist only exists for a show that already happened), so the notes
  // are visible without an extra status-change step.
  it('creates a "went" attendance row with the notes when notes are passed', async () => {
    mockFindOrCreateByName
      .mockResolvedValueOnce({ id: VALID_VENUE_ID })
      .mockResolvedValueOnce({ id: VALID_ARTIST_ID })

    const eventsBuilder = makeQueryBuilder({ data: { id: VALID_EVENT_ID }, error: null })
    const lineupsBuilder = makeQueryBuilder({ data: null, error: null })
    const attendanceUpsert = vi.fn(() => Promise.resolve({ error: null }))
    const fromMock = vi.fn((table: string) => {
      if (table === 'events') return eventsBuilder
      if (table === 'lineups') return lineupsBuilder
      return { upsert: attendanceUpsert }
    })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await addExternalEvent(baseEvent, undefined, '1. Cumbia Rara\n2. Ela')

    expect(attendanceUpsert).toHaveBeenCalledWith(
      { event_id: VALID_EVENT_ID, user_id: 'user-1', status: 'went', notes: '1. Cumbia Rara\n2. Ela' },
      { onConflict: 'event_id,user_id' }
    )
    expect(result).toEqual({ eventId: VALID_EVENT_ID })
  })

  it('does not touch attendance when no notes are passed', async () => {
    mockFindOrCreateByName
      .mockResolvedValueOnce({ id: VALID_VENUE_ID })
      .mockResolvedValueOnce({ id: VALID_ARTIST_ID })

    const eventsBuilder = makeQueryBuilder({ data: { id: VALID_EVENT_ID }, error: null })
    const lineupsBuilder = makeQueryBuilder({ data: null, error: null })
    const attendanceUpsert = vi.fn(() => Promise.resolve({ error: null }))
    const fromMock = vi.fn((table: string) => {
      if (table === 'events') return eventsBuilder
      if (table === 'lineups') return lineupsBuilder
      return { upsert: attendanceUpsert }
    })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    await addExternalEvent(baseEvent)

    expect(attendanceUpsert).not.toHaveBeenCalled()
  })

  it('stops and returns the error when the venue cannot be found or created', async () => {
    mockFindOrCreateByName.mockResolvedValueOnce({ error: 'boom' })

    const result = await addExternalEvent(baseEvent)

    expect(result).toEqual({ error: 'boom' })
    expect(mockFindOrCreateByName).toHaveBeenCalledTimes(1)
  })

  it('falls back to "Artista" when no artist name can be derived', async () => {
    mockFindOrCreateByName
      .mockResolvedValueOnce({ id: VALID_VENUE_ID })
      .mockResolvedValueOnce({ id: VALID_ARTIST_ID })
    const eventsBuilder = makeQueryBuilder({ data: { id: VALID_EVENT_ID }, error: null })
    const lineupsBuilder = makeQueryBuilder({ data: null, error: null })
    const fromMock = vi.fn((table: string) => (table === 'events' ? eventsBuilder : lineupsBuilder))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    await addExternalEvent({
      title: '',
      datetime: '2024-05-01T20:00:00Z',
      venue: { name: 'Niceto Club', city: null, country: null },
      lineup: [],
    } as never)

    expect(mockFindOrCreateByName).toHaveBeenNthCalledWith(2, expect.anything(), 'artists', 'Artista')
  })
})

describe('updateEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('rejects an unauthenticated caller', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await updateEvent(VALID_EVENT_ID, {})
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects a truthy but unparseable date, without touching the client', async () => {
    const result = await updateEvent(VALID_EVENT_ID, { date: 'not-a-date' })
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects an invalid event id', async () => {
    const result = await updateEvent('not-a-uuid', {})
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('replaces the lineup atomically: deletes then re-inserts', async () => {
    const eventsBuilder = makeQueryBuilder({ data: null, error: null })
    const lineupsBuilder = makeQueryBuilder({ data: null, error: null })
    const fromMock = vi.fn((table: string) => (table === 'events' ? eventsBuilder : lineupsBuilder))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    await updateEvent(VALID_EVENT_ID, { artist_ids: [VALID_ARTIST_ID] })

    expect(lineupsBuilder.delete).toHaveBeenCalled()
    expect(lineupsBuilder.insert).toHaveBeenCalledWith([
      { event_id: VALID_EVENT_ID, artist_id: VALID_ARTIST_ID },
    ])
    expect(mockRedirect).toHaveBeenCalledWith(`/events/${VALID_EVENT_ID}`)
  })

  it('rejects an invalid artist id when replacing the lineup, without deleting the old one', async () => {
    const eventsBuilder = makeQueryBuilder({ data: null, error: null })
    const lineupsBuilder = makeQueryBuilder({ data: null, error: null })
    const fromMock = vi.fn((table: string) => (table === 'events' ? eventsBuilder : lineupsBuilder))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await updateEvent(VALID_EVENT_ID, { artist_ids: ['not-a-uuid'] })

    expect(result).toEqual({ error: 'ID de artista inválido.' })
  })
})

describe('deleteEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('rejects an unauthenticated caller', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await deleteEvent(VALID_EVENT_ID)
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects an invalid event id', async () => {
    const result = await deleteEvent('not-a-uuid')
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('deletes lineups before the event, then redirects home', async () => {
    const eventsBuilder = makeQueryBuilder({ data: null, error: null })
    const lineupsBuilder = makeQueryBuilder({ data: null, error: null })
    const fromMock = vi.fn((table: string) => (table === 'events' ? eventsBuilder : lineupsBuilder))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    await deleteEvent(VALID_EVENT_ID)

    expect(lineupsBuilder.delete).toHaveBeenCalled()
    expect(eventsBuilder.delete).toHaveBeenCalled()
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })

  it('stops and returns the error when deleting lineups fails, without deleting the event', async () => {
    const eventsBuilder = makeQueryBuilder({ data: null, error: null })
    const lineupsBuilder = makeQueryBuilder({ data: null, error: { message: 'boom' } })
    const fromMock = vi.fn((table: string) => (table === 'events' ? eventsBuilder : lineupsBuilder))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await deleteEvent(VALID_EVENT_ID)

    expect(result.error).toBeTruthy()
    expect(eventsBuilder.delete).not.toHaveBeenCalled()
  })
})

describe('insertEvent / modifyEvent / removeEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('insertEvent returns the new id without redirecting', async () => {
    const eventsBuilder = makeQueryBuilder({ data: { id: VALID_EVENT_ID }, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => eventsBuilder) }))

    const result = await insertEvent({ name: 'Show', date: '2024-01-01', venue_id: VALID_VENUE_ID } as never)

    expect(result).toEqual({ id: VALID_EVENT_ID })
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  // AllAccess/Passline no tienen API de búsqueda — issue #19 lo resuelve con
  // un link manual por evento en vez de una integración inventada.
  it('insertEvent trims and stores a provided ticket_url', async () => {
    const eventsBuilder = makeQueryBuilder({ data: { id: VALID_EVENT_ID }, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => eventsBuilder) }))

    await insertEvent({
      name: 'Show',
      date: '2024-01-01',
      venue_id: VALID_VENUE_ID,
      ticket_url: '  https://www.allaccess.com.ar/event/show  ',
    } as never)

    expect(eventsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ ticket_url: 'https://www.allaccess.com.ar/event/show' })
    )
  })

  it('insertEvent stores null when ticket_url is omitted', async () => {
    const eventsBuilder = makeQueryBuilder({ data: { id: VALID_EVENT_ID }, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => eventsBuilder) }))

    await insertEvent({ name: 'Show', date: '2024-01-01', venue_id: VALID_VENUE_ID } as never)

    expect(eventsBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ ticket_url: null }))
  })

  it('modifyEvent updates without redirecting', async () => {
    const eventsBuilder = makeQueryBuilder({ data: null, error: null }) as Record<string, unknown>
    eventsBuilder.update = vi.fn(() => eventsBuilder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => eventsBuilder) }))

    const result = await modifyEvent(VALID_EVENT_ID, { name: 'Nuevo nombre' })

    expect(result).toEqual({})
    expect(mockRedirect).not.toHaveBeenCalled()
    expect(eventsBuilder.update).toHaveBeenCalledWith(expect.not.objectContaining({ ticket_url: expect.anything() }))
  })

  it('modifyEvent trims and stores a provided ticket_url', async () => {
    const eventsBuilder = makeQueryBuilder({ data: null, error: null }) as Record<string, unknown>
    eventsBuilder.update = vi.fn(() => eventsBuilder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => eventsBuilder) }))

    await modifyEvent(VALID_EVENT_ID, { ticket_url: '  https://www.passline.com/eventos/show  ' })

    expect(eventsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ ticket_url: 'https://www.passline.com/eventos/show' })
    )
  })

  it('modifyEvent clears ticket_url to null when set to an empty string', async () => {
    const eventsBuilder = makeQueryBuilder({ data: null, error: null }) as Record<string, unknown>
    eventsBuilder.update = vi.fn(() => eventsBuilder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => eventsBuilder) }))

    await modifyEvent(VALID_EVENT_ID, { ticket_url: '   ' })

    expect(eventsBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ ticket_url: null }))
  })

  it('removeEvent deletes lineups and the event without redirecting', async () => {
    const eventsBuilder = makeQueryBuilder({ data: null, error: null })
    const lineupsBuilder = makeQueryBuilder({ data: null, error: null })
    const fromMock = vi.fn((table: string) => (table === 'events' ? eventsBuilder : lineupsBuilder))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await removeEvent(VALID_EVENT_ID)

    expect(lineupsBuilder.delete).toHaveBeenCalled()
    expect(eventsBuilder.delete).toHaveBeenCalled()
    expect(result).toEqual({})
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
