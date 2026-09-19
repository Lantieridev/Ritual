import { describe, it, expect, vi, beforeEach } from 'vitest'

const insert = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({ from: (t: string) => (t === 'cron_runs' ? { insert } : {}) }),
}))

const deliverNotifications = vi.fn()
vi.mock('@/src/domains/notifications/jobs/deliverNotifications', () => ({
    deliverNotifications: (...args: unknown[]) => deliverNotifications(...args),
}))

import { GET } from './route'

function req(secret = 'test-secret') {
    return new Request('http://localhost/api/cron/deliver-notifications', {
        headers: { authorization: `Bearer ${secret}` },
    })
}

describe('GET /api/cron/deliver-notifications', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        insert.mockResolvedValue({ error: null })
        deliverNotifications.mockResolvedValue({ ok: true, details: { claimed: 2, sent: 2, retried: 0, failed: 0 } })
        vi.stubEnv('CRON_SECRET', 'test-secret')
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
        vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
        vi.stubEnv('RESEND_API_KEY', 're_key')
        vi.stubEnv('NOTIFICATIONS_FROM_EMAIL', 'Ritual <avisos@ritual.app>')
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://ritual.app')
    })

    it('rejects a wrong bearer secret', async () => {
        expect((await GET(req('wrong'))).status).toBe(401)
    })

    it('fails closed with 503 when the email provider is not configured', async () => {
        vi.stubEnv('RESEND_API_KEY', '')

        const res = await GET(req())

        expect(res.status).toBe(503)
        expect(deliverNotifications).not.toHaveBeenCalled()
    })

    it('runs the delivery job and records the run', async () => {
        const res = await GET(req())

        expect(await res.json()).toEqual({ success: true, claimed: 2, sent: 2, retried: 0, failed: 0 })
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ job: 'deliver-notifications', ok: true }))
    })
})
