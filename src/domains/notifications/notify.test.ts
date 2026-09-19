import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { notify } from './notify'

const maybeSingle = vi.fn()
const single = vi.fn()
const insert = vi.fn()

function makeSupabase() {
    return {
        from: (table: string) => {
            if (table === 'notification_preferences') {
                return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }) }
            }
            return { insert: (row: unknown) => { insert(row); return { select: () => ({ single }) } } }
        },
    } as unknown as SupabaseClient
}

const input = {
    userId: 'u1',
    type: 'admin_message' as const,
    title: 'Hola',
    body: 'Cuerpo',
    payload: { a: 1 },
    dedupeKey: 'k1',
}

describe('notify', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, 'error').mockImplementation(() => {})
        maybeSingle.mockResolvedValue({ data: null, error: null })
        single.mockResolvedValue({ data: { id: 'n1' }, error: null })
    })

    it('inserts with both channels on by default and marks email as pending', async () => {
        const result = await notify(makeSupabase(), input)

        expect(result).toEqual({ outcome: 'created', id: 'n1' })
        expect(insert).toHaveBeenCalledWith({
            user_id: 'u1',
            type: 'admin_message',
            title: 'Hola',
            body: 'Cuerpo',
            payload: { a: 1 },
            dedupe_key: 'k1',
            in_app: true,
            email_status: 'pending',
        })
    })

    it('skips email when the user turned it off', async () => {
        maybeSingle.mockResolvedValue({ data: { in_app: true, email: false }, error: null })

        await notify(makeSupabase(), input)

        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ in_app: true, email_status: 'skipped' }))
    })

    it('keeps the row as an email-only job when in-app is off', async () => {
        maybeSingle.mockResolvedValue({ data: { in_app: false, email: true }, error: null })

        await notify(makeSupabase(), input)

        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ in_app: false, email_status: 'pending' }))
    })

    it('inserts nothing when both channels are off', async () => {
        maybeSingle.mockResolvedValue({ data: { in_app: false, email: false }, error: null })

        const result = await notify(makeSupabase(), input)

        expect(result).toEqual({ outcome: 'suppressed' })
        expect(insert).not.toHaveBeenCalled()
    })

    it('reports a duplicate when the dedupe index rejects the insert', async () => {
        single.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } })

        expect(await notify(makeSupabase(), input)).toEqual({ outcome: 'duplicate' })
    })

    it('logs and returns failed on any other database error, without throwing', async () => {
        single.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } })

        expect(await notify(makeSupabase(), input)).toEqual({ outcome: 'failed' })
        expect(console.error).toHaveBeenCalled()
    })

    it('falls back to defaults when the preference read fails', async () => {
        maybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } })

        const result = await notify(makeSupabase(), input)

        expect(result.outcome).toBe('created')
    })

    it('never throws even when the client itself throws', async () => {
        const broken = { from: () => { throw new Error('network') } } as unknown as SupabaseClient

        expect(await notify(broken, input)).toEqual({ outcome: 'failed' })
    })
})
