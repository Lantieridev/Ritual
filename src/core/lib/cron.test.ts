import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authorizeCron, recordCronRun } from './cron'

function makeRequest(secret?: string) {
    const headers: Record<string, string> = secret !== undefined ? { authorization: `Bearer ${secret}` } : {}
    return new Request('http://localhost/api/cron/x', { headers })
}

describe('authorizeCron', () => {
    beforeEach(() => {
        vi.stubEnv('CRON_SECRET', 'the-secret')
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('fails closed with 503 when CRON_SECRET is not configured', () => {
        vi.stubEnv('CRON_SECRET', '')

        const result = authorizeCron(makeRequest('anything'))

        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.response.status).toBe(503)
    })

    it('rejects with 401 when the bearer secret does not match', () => {
        const result = authorizeCron(makeRequest('wrong'))

        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.response.status).toBe(401)
    })

    it('rejects with 401 when no authorization header is present at all', () => {
        const result = authorizeCron(makeRequest())

        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.response.status).toBe(401)
    })

    it('authorizes a request whose bearer secret matches', () => {
        const result = authorizeCron(makeRequest('the-secret'))

        expect(result.ok).toBe(true)
    })
})

describe('recordCronRun', () => {
    it('writes the given details and defaults every legacy counter to 0 when none is passed', async () => {
        const insert = vi.fn().mockResolvedValue({ error: null })
        const supabase = { from: () => ({ insert }) } as never

        await recordCronRun(supabase, {
            job: 'refresh-artist-importance',
            startedAt: new Date('2026-08-19T00:00:00.000Z'),
            ok: true,
            details: { processed: 3, stopped_reason: 'deadline' },
        })

        expect(insert).toHaveBeenCalledWith({
            job: 'refresh-artist-importance',
            started_at: '2026-08-19T00:00:00.000Z',
            ok: true,
            details: { processed: 3, stopped_reason: 'deadline' },
            adapters_total: 0,
            adapters_failed: 0,
            failed_adapter_ids: [],
            events_inserted: 0,
        })
    })

    it('writes the caller-supplied legacy counters instead of the defaults when given', async () => {
        const insert = vi.fn().mockResolvedValue({ error: null })
        const supabase = { from: () => ({ insert }) } as never

        await recordCronRun(supabase, {
            job: 'sync-external-sources',
            startedAt: new Date('2026-08-19T00:00:00.000Z'),
            ok: false,
            legacy: { adaptersTotal: 2, adaptersFailed: 1, failedAdapterIds: ['b'], eventsInserted: 5 },
        })

        expect(insert).toHaveBeenCalledWith(
            expect.objectContaining({
                details: {},
                adapters_total: 2,
                adapters_failed: 1,
                failed_adapter_ids: ['b'],
                events_inserted: 5,
            })
        )
    })

    it('logs the error instead of throwing when the insert fails', async () => {
        const insert = vi.fn().mockResolvedValue({ error: new Error('boom') })
        const supabase = { from: () => ({ insert }) } as never
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

        await expect(
            recordCronRun(supabase, { job: 'x', startedAt: new Date('2026-08-19T00:00:00.000Z'), ok: true })
        ).resolves.toBeUndefined()

        expect(consoleError).toHaveBeenCalled()
        consoleError.mockRestore()
    })
})
