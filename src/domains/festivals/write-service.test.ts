import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import {
  insertFestival,
  removeFestival,
  saveFestivalAttendance,
  linkEventToFestival,
  markFestivalArtistSeen,
  unmarkFestivalArtistSeen,
  listFestivalSeenArtistsByDay,
} from '@/src/domains/festivals/service'
import { getCurrentUserId } from '@/src/core/auth/session'

const VALID_FESTIVAL_ID = '11111111-1111-1111-1111-111111111111'
const VALID_EVENT_ID = '22222222-2222-2222-2222-222222222222'

/**
 * `insertFestival` y `linkEventToFestival` consultan el RPC `is_moderator`
 * antes de escribir — los festivales quedan fuera de la cola de moderación,
 * así que crearlos y armarles el line-up es top-down. Por defecto los tests
 * corren como moderador; los que prueban el rechazo lo sobrescriben.
 */
const moderatorRpc = vi.fn(() => Promise.resolve({ data: true, error: null }))

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.insert = vi.fn(chain)
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.delete = vi.fn(chain)
  builder.upsert = vi.fn(() => Promise.resolve(result))
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

describe('insertFestival', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('rejects an unauthenticated caller', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await insertFestival({ name: 'Cosquin Rock', start_date: '2024-01-01' })
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects a missing name or start date', async () => {
    const noName = await insertFestival({ name: '', start_date: '2024-01-01' })
    expect(noName.error).toBeTruthy()

    const noDate = await insertFestival({ name: 'Cosquin Rock', start_date: '' })
    expect(noDate.error).toBeTruthy()

    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('creates the festival and returns its id for the caller to navigate to', async () => {
    const builder = makeQueryBuilder({ data: { id: VALID_FESTIVAL_ID }, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder), rpc: moderatorRpc }))

    const result = await insertFestival({ name: 'Cosquin Rock', start_date: '2024-01-01' })

    expect(result).toEqual({ id: VALID_FESTIVAL_ID })
  })

  it('returns a sanitized error when the insert fails', async () => {
    const builder = makeQueryBuilder({
      data: null,
      error: { message: 'duplicate key value violates unique constraint' },
    })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder), rpc: moderatorRpc }))

    const result = await insertFestival({ name: 'Cosquin Rock', start_date: '2024-01-01' })

    expect(result.error).toBe('Ya existe un registro con esos datos.')
  })

  it('rejects a caller who is not a moderator, without inserting', async () => {
    const builder = makeQueryBuilder({ data: { id: VALID_FESTIVAL_ID }, error: null })
    const rejectingRpc = vi.fn(() => Promise.resolve({ data: false, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder), rpc: rejectingRpc }))

    const result = await insertFestival({ name: 'Cosquin Rock', start_date: '2024-01-01' })

    expect(result.error).toBeTruthy()
    expect(builder.insert).not.toHaveBeenCalled()
  })

  it('returns a sanitized error when the role check itself fails', async () => {
    const builder = makeQueryBuilder({ data: { id: VALID_FESTIVAL_ID }, error: null })
    const failingRpc = vi.fn(() => Promise.resolve({ data: null, error: { message: 'boom' } }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder), rpc: failingRpc }))

    const result = await insertFestival({ name: 'Cosquin Rock', start_date: '2024-01-01' })

    expect(result.error).toBeTruthy()
    expect(builder.insert).not.toHaveBeenCalled()
  })
})

describe('removeFestival', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('rejects an unauthenticated caller', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await removeFestival(VALID_FESTIVAL_ID)
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects an invalid id', async () => {
    const result = await removeFestival('not-a-uuid')
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('deletes the festival row', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder), rpc: moderatorRpc }))

    await removeFestival(VALID_FESTIVAL_ID)

    expect(builder.delete).toHaveBeenCalled()
  })

  it('rejects a caller who is not a moderator, without deleting', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    const rejectingRpc = vi.fn(() => Promise.resolve({ data: false, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder), rpc: rejectingRpc }))

    const result = await removeFestival(VALID_FESTIVAL_ID)

    expect(result.error).toBeTruthy()
    expect(builder.delete).not.toHaveBeenCalled()
  })
})

describe('insertFestival / removeFestival payloads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('removeFestival resolves to an empty payload on success', async () => {
    const builder = makeQueryBuilder({ data: [{ id: VALID_FESTIVAL_ID }], error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder), rpc: moderatorRpc }))

    const result = await removeFestival(VALID_FESTIVAL_ID)

    expect(result).toEqual({})
  })

  // Un DELETE que RLS bloquea (o un id que ya no existe) no es un error para
  // PostgREST: afecta 0 filas y devuelve error: null. Sin este chequeo se
  // reportaba éxito aunque el festival siguiera ahí -mismo patrón que
  // removeEvent.
  it('reports an error instead of a false success when the delete affects 0 rows', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder), rpc: moderatorRpc }))

    const result = await removeFestival(VALID_FESTIVAL_ID)

    expect(result.error).toBeTruthy()
  })
})

describe('saveFestivalAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('rejects an invalid festival id', async () => {
    const result = await saveFestivalAttendance('not-a-uuid', 'going')
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects a rating outside 1-5, without touching the client', async () => {
    const zero = await saveFestivalAttendance(VALID_FESTIVAL_ID, 'went', 0)
    expect(zero.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()

    const six = await saveFestivalAttendance(VALID_FESTIVAL_ID, 'went', 6)
    expect(six.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('requires a logged-in user', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await saveFestivalAttendance(VALID_FESTIVAL_ID, 'going')
    expect(result.error).toBeTruthy()
  })

  it('upserts on the (user_id, festival_id) unique constraint', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await saveFestivalAttendance(VALID_FESTIVAL_ID, 'went', 5, 'Genial')

    expect(builder.upsert).toHaveBeenCalledWith(
      {
        festival_id: VALID_FESTIVAL_ID,
        user_id: 'user-1',
        status: 'went',
        rating: 5,
        review: 'Genial',
      },
      { onConflict: 'user_id,festival_id' }
    )
    expect(result).toEqual({})
  })

  it('returns a sanitized error when the upsert fails', async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: 'boom' } })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await saveFestivalAttendance(VALID_FESTIVAL_ID, 'going')

    expect(result.error).toBeTruthy()
  })
})

describe('linkEventToFestival', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('rejects an unauthenticated caller', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await linkEventToFestival(VALID_FESTIVAL_ID, VALID_EVENT_ID)
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects invalid festival or event ids', async () => {
    const badFestival = await linkEventToFestival('not-a-uuid', VALID_EVENT_ID)
    expect(badFestival.error).toBeTruthy()

    const badEvent = await linkEventToFestival(VALID_FESTIVAL_ID, 'not-a-uuid')
    expect(badEvent.error).toBeTruthy()

    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('inserts the festival_events link and revalidates', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder), rpc: moderatorRpc }))

    const result = await linkEventToFestival(VALID_FESTIVAL_ID, VALID_EVENT_ID, 'Día 1')

    expect(builder.insert).toHaveBeenCalledWith({
      festival_id: VALID_FESTIVAL_ID,
      event_id: VALID_EVENT_ID,
      day_label: 'Día 1',
    })
    expect(result).toEqual({})
  })

  it('returns a sanitized error when the insert fails', async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: 'boom' } })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder), rpc: moderatorRpc }))

    const result = await linkEventToFestival(VALID_FESTIVAL_ID, VALID_EVENT_ID)

    expect(result.error).toBeTruthy()
  })

  it('rejects a caller who is not a moderator, without inserting', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    const rejectingRpc = vi.fn(() => Promise.resolve({ data: false, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder), rpc: rejectingRpc }))

    const result = await linkEventToFestival(VALID_FESTIVAL_ID, VALID_EVENT_ID)

    expect(result.error).toBeTruthy()
    expect(builder.insert).not.toHaveBeenCalled()
  })
})

describe('festival seen artists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('marks a lineup artist as seen for each matching festival day and deduplicates by event', async () => {
    const festivalDays = [{
      event_id: '22222222-2222-2222-2222-222222222222',
      events: {
        id: '22222222-2222-2222-2222-222222222222',
        date: '2026-02-01',
        lineups: [{ artist_id: '33333333-3333-3333-3333-333333333333' }],
      },
    }]
    const seenBuilder = makeQueryBuilder({ data: null, error: null })
    const dayBuilder = makeQueryBuilder({ data: festivalDays, error: null })
    mockCreateClient.mockReturnValue(
      Promise.resolve({
        from: vi.fn((table: string) => (table === 'festival_events' ? dayBuilder : seenBuilder)),
      })
    )

    const result = await markFestivalArtistSeen(VALID_FESTIVAL_ID, '33333333-3333-3333-3333-333333333333')

    expect(result).toEqual({})
    expect(seenBuilder.upsert).toHaveBeenCalledWith(
      [{
        festival_id: VALID_FESTIVAL_ID,
        user_id: 'user-1',
        artist_id: '33333333-3333-3333-3333-333333333333',
        event_id: '22222222-2222-2222-2222-222222222222',
      }],
      { onConflict: 'user_id,festival_id,artist_id,event_id', ignoreDuplicates: true }
    )
  })

  it('rejects artists not on the festival lineup', async () => {
    const dayBuilder = makeQueryBuilder({ data: [{ event_id: 'e1', events: { id: 'e1', date: '2026-02-01', lineups: [] } }], error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => dayBuilder) }))

    const result = await markFestivalArtistSeen(VALID_FESTIVAL_ID, '33333333-3333-3333-3333-333333333333')

    expect(result.error).toBe('Ese artista no pertenece al cartel del festival.')
  })

  it('removes a festival artist from the seen list for the current user', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await unmarkFestivalArtistSeen(VALID_FESTIVAL_ID, '33333333-3333-3333-3333-333333333333')

    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('festival_id', VALID_FESTIVAL_ID)
    expect(result).toEqual({})
  })

  it('groups seen artists by festival day using the inferred event/day metadata', async () => {
    const seenBuilder = makeQueryBuilder({
      data: [
        {
          event_id: '22222222-2222-2222-2222-222222222222',
          artist_id: '33333333-3333-3333-3333-333333333333',
          artists: { id: '33333333-3333-3333-3333-333333333333', name: 'Bandalos Chinos' },
          events: { id: '22222222-2222-2222-2222-222222222222', date: '2026-02-01' },
        },
      ],
      error: null,
    })
    const dayBuilder = makeQueryBuilder({
      data: [{ event_id: '22222222-2222-2222-2222-222222222222', day_label: 'Día 1' }],
      error: null,
    })
    mockCreateClient.mockReturnValue(
      Promise.resolve({
        from: vi.fn((table: string) => (table === 'festival_artist_seen' ? seenBuilder : dayBuilder)),
      })
    )

    const result = await listFestivalSeenArtistsByDay(VALID_FESTIVAL_ID)

    expect(result).toEqual([
      { dayLabel: 'Día 1', date: '2026-02-01', artists: [{ id: '33333333-3333-3333-3333-333333333333', name: 'Bandalos Chinos' }] },
    ])
  })
})
