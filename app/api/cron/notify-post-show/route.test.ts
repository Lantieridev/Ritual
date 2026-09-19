import { describe, it, expect, vi, beforeEach } from 'vitest'

const insert = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({ from: (t: string) => (t === 'cron_runs' ? { insert } : {}) }),
}))

const notifyPostShow = vi.fn()
vi.mock('@/src/domains/notifications/jobs/notifyPostShow', () => ({
    notifyPostShow: (...args: unknown[]) => notifyPostShow(...args),
}))

import { GET } from './route'

const details = { events: 1, candidates: 2, created: 2, duplicates: 0, suppressed: 0, failed: 0, complete: 0 }

function req(secret = 'test-secret') {
    return new Request('http://localhost/api/cron/notify-post-show', { headers: { authorization: `Bearer ${secret}` } })
}

describe('GET /api/cron/notify-post-show', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        insert.mockResolvedValue({ error: null })
        notifyPostShow.mockResolvedValue({ ok: true, details })
        vi.stubEnv('CRON_SECRET', 'test-secret')
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
        vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
    })

    it('rejects a wrong bearer secret', async () => {
        expect((await GET(req('wrong'))).status).toBe(401)
    })

    it('fails closed when CRON_SECRET is missing', async () => {
        vi.stubEnv('CRON_SECRET', '')
        expect((await GET(req())).status).toBe(503)
    })

    it('runs the job and records the run', async () => {
        const res = await GET(req())

        expect(await res.json()).toEqual({ success: true, ...details })
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ job: 'notify-post-show', ok: true }))
    })
})
