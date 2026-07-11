import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()
const mockRedirect = vi.fn()
const mockFindOrCreateByName = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}))

vi.mock('@/src/core/lib/find-or-create', () => ({
  findOrCreateByName: (...args: unknown[]) => mockFindOrCreateByName(...args),
}))

import { createEvent, addExternalEvent, updateEvent, deleteEvent } from '@/src/domains/events/actions'
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
})

describe('addExternalEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseEvent: FutureEvent = {
    title: 'Show en Niceto',
    datetime: '2024-05-01T20:00:00Z',
    venue: { name: 'Niceto Club', city: 'CABA', country: 'AR' },
    lineup: ['Bandalos Chinos'],
  } as FutureEvent

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
