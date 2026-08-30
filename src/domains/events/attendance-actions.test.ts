import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

import {
  getOrCreateAttendance,
  setAttendanceStatus,
  saveMemory,
} from '@/src/domains/events/attendance-actions'
import { getCurrentUserId } from '@/src/core/auth/session'

const VALID_EVENT_ID = '11111111-1111-1111-1111-111111111111'

function makeQueryBuilder(
  selectResult: { data: unknown; error: unknown },
  upsertResult: { data: unknown; error: unknown } = { data: null, error: null }
) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(selectResult))
  builder.upsert = vi.fn(() => {
    const upsertBuilder: Record<string, unknown> = {}
    const upsertChain = () => upsertBuilder
    upsertBuilder.select = vi.fn(upsertChain)
    upsertBuilder.single = vi.fn(() => Promise.resolve(upsertResult))
    upsertBuilder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(upsertResult).then(onFulfilled, onRejected)
    return upsertBuilder
  })
  return builder
}

describe('getOrCreateAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('returns the existing row without writing when attendance already exists', async () => {
    const builder = makeQueryBuilder({ data: { id: 'att-1', status: 'going' }, error: null })
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getOrCreateAttendance(VALID_EVENT_ID)

    expect(result).toEqual({ id: 'att-1', status: 'going' })
    expect(builder.upsert).not.toHaveBeenCalled()
  })

  it(
    'upserts on conflict instead of a bare insert when creating ' +
      '(regression test: a bare insert would throw a unique-violation and return null ' +
      'if two requests race past the initial select at the same time)',
    async () => {
      const builder = makeQueryBuilder(
        { data: null, error: { code: 'PGRST116' } },
        { data: { id: 'att-new', status: 'interested' }, error: null }
      )
      const fromMock = vi.fn(() => builder)
      mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

      const result = await getOrCreateAttendance(VALID_EVENT_ID)

      expect(builder.upsert).toHaveBeenCalledWith(
        { event_id: VALID_EVENT_ID, user_id: 'user-1', status: 'interested' },
        { onConflict: 'event_id,user_id', ignoreDuplicates: false }
      )
      expect(result).toEqual({ id: 'att-new', status: 'interested' })
    }
  )

  it('returns null for an invalid event id without touching the client', async () => {
    const result = await getOrCreateAttendance('not-a-uuid')

    expect(result).toBeNull()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns null when there is no logged-in user', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)

    const result = await getOrCreateAttendance(VALID_EVENT_ID)

    expect(result).toBeNull()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns null when the upsert fails', async () => {
    const builder = makeQueryBuilder(
      { data: null, error: { code: 'PGRST116' } },
      { data: null, error: { message: 'boom' } }
    )
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getOrCreateAttendance(VALID_EVENT_ID)

    expect(result).toBeNull()
  })
})

describe('setAttendanceStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('rejects an invalid event id', async () => {
    const result = await setAttendanceStatus('not-a-uuid', 'going')

    expect(result).toEqual({ error: 'Evento inválido.' })
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects an invalid status', async () => {
    const result = await setAttendanceStatus(VALID_EVENT_ID, 'maybe' as never)

    expect(result).toEqual({ error: 'Estado de asistencia inválido.' })
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('requires a logged-in user', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)

    const result = await setAttendanceStatus(VALID_EVENT_ID, 'going')

    expect(result).toEqual({ error: 'Usuario no autenticado' })
  })

  it('upserts the status in a single atomic call, not a select-then-write', async () => {
    const upsertMock = vi.fn(() => Promise.resolve({ error: null }))
    const fromMock = vi.fn(() => ({ upsert: upsertMock }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await setAttendanceStatus(VALID_EVENT_ID, 'went')

    expect(upsertMock).toHaveBeenCalledWith(
      { event_id: VALID_EVENT_ID, user_id: 'user-1', status: 'went' },
      { onConflict: 'event_id,user_id' }
    )
    expect(result).toEqual({})
  })

  it('returns a sanitized error when the upsert fails', async () => {
    const upsertMock = vi.fn(() =>
      Promise.resolve({ error: { message: 'duplicate key value violates unique constraint' } })
    )
    const fromMock = vi.fn(() => ({ upsert: upsertMock }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await setAttendanceStatus(VALID_EVENT_ID, 'went')

    expect(result.error).toBe('Ya existe un registro con esos datos.')
  })
})

describe('saveMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('rejects an invalid event id', async () => {
    const result = await saveMemory('not-a-uuid', {})

    expect(result).toEqual({ error: 'Evento inválido.' })
  })

  it('rejects an out-of-range rating', async () => {
    const result = await saveMemory(VALID_EVENT_ID, { rating: 9 })

    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('fails gracefully when the underlying attendance cannot be obtained', async () => {
    const result = await saveMemory('not-a-uuid', { rating: 4 })

    expect(result.error).toBeTruthy()
  })

  it('updates only the fields that were actually passed, scoped by attendance id', async () => {
    const attendanceSelectBuilder = makeQueryBuilder(
      { data: { id: 'att-1', status: 'went' }, error: null }
    )
    const updateEq = vi.fn(() => Promise.resolve({ error: null }))
    const updateMock = vi.fn(() => ({ eq: updateEq }))
    let callCount = 0
    const fromMock = vi.fn(() => {
      callCount++
      // getOrCreateAttendance does the first from('attendance') call (select),
      // saveMemory's own update is the second from('attendance') call.
      return callCount === 1 ? attendanceSelectBuilder : { update: updateMock }
    })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await saveMemory(VALID_EVENT_ID, { rating: 5, review: 'Genial' })

    expect(updateMock).toHaveBeenCalledWith({ rating: 5, review: 'Genial' })
    expect(updateEq).toHaveBeenCalledWith('id', 'att-1')
    expect(result).toEqual({})
  })

  // Issue #62: reducción de daños.
  it('includes used_ear_protection in the update payload when passed', async () => {
    const attendanceSelectBuilder = makeQueryBuilder(
      { data: { id: 'att-1', status: 'went' }, error: null }
    )
    const updateEq = vi.fn(() => Promise.resolve({ error: null }))
    const updateMock = vi.fn(() => ({ eq: updateEq }))
    let callCount = 0
    const fromMock = vi.fn(() => {
      callCount++
      return callCount === 1 ? attendanceSelectBuilder : { update: updateMock }
    })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    await saveMemory(VALID_EVENT_ID, { usedEarProtection: true })

    expect(updateMock).toHaveBeenCalledWith({ used_ear_protection: true })
  })

  // Issue #28: zona/sector.
  it('sanitizes and includes zone in the update payload when passed', async () => {
    const attendanceSelectBuilder = makeQueryBuilder(
      { data: { id: 'att-1', status: 'went' }, error: null }
    )
    const updateEq = vi.fn(() => Promise.resolve({ error: null }))
    const updateMock = vi.fn(() => ({ eq: updateEq }))
    let callCount = 0
    const fromMock = vi.fn(() => {
      callCount++
      return callCount === 1 ? attendanceSelectBuilder : { update: updateMock }
    })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    await saveMemory(VALID_EVENT_ID, { zone: '  Campo General  ' })

    expect(updateMock).toHaveBeenCalledWith({ zone: 'Campo General' })
  })

  it('clears the zone with an empty string, same as the ticket link convention', async () => {
    const attendanceSelectBuilder = makeQueryBuilder(
      { data: { id: 'att-1', status: 'went' }, error: null }
    )
    const updateEq = vi.fn(() => Promise.resolve({ error: null }))
    const updateMock = vi.fn(() => ({ eq: updateEq }))
    let callCount = 0
    const fromMock = vi.fn(() => {
      callCount++
      return callCount === 1 ? attendanceSelectBuilder : { update: updateMock }
    })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    await saveMemory(VALID_EVENT_ID, { zone: '' })

    expect(updateMock).toHaveBeenCalledWith({ zone: null })
  })

  it('returns a sanitized error when the attendance update fails', async () => {
    const attendanceSelectBuilder = makeQueryBuilder(
      { data: { id: 'att-1', status: 'went' }, error: null }
    )
    const updateEq = vi.fn(() => Promise.resolve({ error: { message: 'boom' } }))
    const updateMock = vi.fn(() => ({ eq: updateEq }))
    let callCount = 0
    const fromMock = vi.fn(() => {
      callCount++
      return callCount === 1 ? attendanceSelectBuilder : { update: updateMock }
    })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await saveMemory(VALID_EVENT_ID, { notes: 'nota' })

    expect(result.error).toBeTruthy()
  })
})
