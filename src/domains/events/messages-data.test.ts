import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
    createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
    getCurrentUserId: vi.fn(),
}))

import { getEventMessages, addEventMessage } from '@/src/domains/events/messages-data'
import { getCurrentUserId } from '@/src/core/auth/session'

function makeBuilder(result: { data: unknown; error: unknown }) {
    const builder: Record<string, unknown> = {}
    const chain = () => builder
    builder.select = vi.fn(chain)
    builder.eq = vi.fn(chain)
    builder.in = vi.fn(chain)
    builder.order = vi.fn(chain)
    builder.insert = vi.fn(chain)
    builder.single = vi.fn(() => Promise.resolve(result))
    builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled, onRejected)
    return builder
}

describe('getEventMessages', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('resuelve el nombre del autor con una segunda consulta a profiles', async () => {
        const messagesBuilder = makeBuilder({
            data: [
                { id: 'm1', user_id: 'u1', body: 'Nos vemos en la puerta', created_at: '2026-01-01T00:00:00Z' },
                { id: 'm2', user_id: 'u2', body: 'Dale, ahí llego', created_at: '2026-01-01T00:01:00Z' },
            ],
            error: null,
        })
        const profilesBuilder = makeBuilder({
            data: [
                { id: 'u1', username: 'martin' },
                { id: 'u2', username: null },
            ],
            error: null,
        })
        const fromMock = vi.fn((table: string) => (table === 'event_messages' ? messagesBuilder : profilesBuilder))
        mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

        const result = await getEventMessages('e1')

        expect(messagesBuilder.eq).toHaveBeenCalledWith('event_id', 'e1')
        expect(profilesBuilder.in).toHaveBeenCalledWith('id', ['u1', 'u2'])
        expect(result).toEqual([
            { id: 'm1', user_id: 'u1', body: 'Nos vemos en la puerta', created_at: '2026-01-01T00:00:00Z', author_username: 'martin' },
            { id: 'm2', user_id: 'u2', body: 'Dale, ahí llego', created_at: '2026-01-01T00:01:00Z', author_username: null },
        ])
    })

    it('no consulta profiles si no hay mensajes', async () => {
        const messagesBuilder = makeBuilder({ data: [], error: null })
        const fromMock = vi.fn(() => messagesBuilder)
        mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

        const result = await getEventMessages('e1')

        expect(result).toEqual([])
        expect(fromMock).toHaveBeenCalledTimes(1)
    })

    it('devuelve [] si la consulta de mensajes falla', async () => {
        const messagesBuilder = makeBuilder({ data: null, error: { message: 'boom' } })
        mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => messagesBuilder) }))

        const result = await getEventMessages('e1')

        expect(result).toEqual([])
    })
})

describe('addEventMessage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentUserId).mockResolvedValue('u1')
    })

    it('rejects an unauthenticated caller', async () => {
        vi.mocked(getCurrentUserId).mockResolvedValue(null)
        const result = await addEventMessage('e1', 'hola')
        expect(result.error).toBeTruthy()
        expect(mockCreateClient).not.toHaveBeenCalled()
    })

    it('rejects an empty body without touching the database', async () => {
        const result = await addEventMessage('e1', '   ')
        expect(result).toEqual({ error: 'El mensaje no puede estar vacío.' })
        expect(mockCreateClient).not.toHaveBeenCalled()
    })

    it('inserts the message with the current user id and returns its id', async () => {
        const builder = makeBuilder({ data: { id: 'm-new' }, error: null })
        const fromMock = vi.fn(() => builder)
        mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

        const result = await addEventMessage('e1', 'Nos vemos a las 20')

        expect(fromMock).toHaveBeenCalledWith('event_messages')
        expect(builder.insert).toHaveBeenCalledWith({ event_id: 'e1', user_id: 'u1', body: 'Nos vemos a las 20' })
        expect(result).toEqual({ id: 'm-new' })
    })

    it(
        'maps an RLS policy violation (42501, no attendance on this event) to a friendly message',
        async () => {
            const builder = makeBuilder({ data: null, error: { code: '42501', message: 'new row violates row-level security policy' } })
            mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

            const result = await addEventMessage('e1', 'hola')

            expect(result).toEqual({ error: 'Necesitás marcar tu asistencia a este show para escribir acá.' })
        }
    )
})
