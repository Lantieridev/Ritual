import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ExternalSourceAdapter } from '@/src/core/lib/external-sources/types'

const mockUpsert = vi.fn()
const mockInsert = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({
        from: (table: string) => {
            if (table === 'cron_runs') return { insert: mockInsert }
            return { upsert: mockUpsert }
        },
    }),
}))

const mockAdapters: ExternalSourceAdapter[] = []
vi.mock('@/src/core/lib/external-sources/adapters', () => ({
    get externalAdapters() {
        return mockAdapters
    },
}))

import { GET } from './route'

function adapter(id: string, result: Awaited<ReturnType<ExternalSourceAdapter['search']>> | Error): ExternalSourceAdapter {
    return {
        id,
        name: id,
        type: 'api',
        isConfigured: () => true,
        search: result instanceof Error ? vi.fn().mockRejectedValue(result) : vi.fn().mockResolvedValue(result),
    }
}

function makeRequest(secret = 'test-secret') {
    return new Request('http://localhost:3000/api/cron/sync-external-sources', {
        headers: { authorization: `Bearer ${secret}` },
    })
}

describe('GET /api/cron/sync-external-sources', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAdapters.length = 0
        mockUpsert.mockResolvedValue({ error: null })
        mockInsert.mockResolvedValue({ error: null })
        vi.stubEnv('CRON_SECRET', 'test-secret')
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
        vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    })

    it('rejects a request without the correct bearer secret', async () => {
        const res = await GET(makeRequest('wrong'))
        expect(res.status).toBe(401)
    })

    it('fails closed when CRON_SECRET is not configured', async () => {
        vi.stubEnv('CRON_SECRET', '')
        const res = await GET(makeRequest())
        expect(res.status).toBe(503)
    })

    it('reports success and persists the run when adapters mostly succeed', async () => {
        mockAdapters.push(
            adapter('a', { events: [{ id: '1', title: 'Show', datetime: '2026-09-01T00:00:00Z', venue: { name: 'V', city: null }, lineup: [], url: 'https://x' }], total: 1 }),
            adapter('b', new Error('network down'))
        )

        const res = await GET(makeRequest())
        const body = await res.json()

        expect(body).toEqual({ success: true, inserted: 1, failedAdapters: 1 })
        expect(mockInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                job: 'sync-external-sources',
                adapters_total: 2,
                adapters_failed: 1,
                failed_adapter_ids: ['b'],
                events_inserted: 1,
                ok: true,
            })
        )
    })

    it('reports failure when every adapter fails, without crashing', async () => {
        mockAdapters.push(adapter('a', new Error('down')), adapter('b', { events: [], total: 0, error: 'down too' }))

        const res = await GET(makeRequest())
        const body = await res.json()

        expect(body).toEqual({ success: false, inserted: 0, failedAdapters: 2 })
        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ ok: false, failed_adapter_ids: ['a', 'b'] }))
    })
})
