import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CronSupabaseClient } from '@/src/core/lib/cron'
import type { EmailSender } from '../email/types'
import { deliverNotifications } from './deliverNotifications'

const rpc = vi.fn()
const getUserById = vi.fn()
const updateEq = vi.fn()
const update = vi.fn()

function makeSupabase() {
    return {
        rpc,
        auth: { admin: { getUserById } },
        from: () => ({ update: (patch: unknown) => { update(patch); return { eq: updateEq } } }),
    } as unknown as CronSupabaseClient
}

function row(overrides: Record<string, unknown> = {}) {
    return { id: 'n1', user_id: 'u1', title: 'Hola', body: 'Cuerpo', email_attempts: 1, ...overrides }
}

describe('deliverNotifications', () => {
    let sender: EmailSender

    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, 'error').mockImplementation(() => {})
        sender = { send: vi.fn().mockResolvedValue(undefined) }
        getUserById.mockResolvedValue({ data: { user: { email: 'a@b.com' } }, error: null })
        updateEq.mockResolvedValue({ error: null })
    })

    it('claims a batch, sends each email and marks the row sent', async () => {
        rpc.mockResolvedValue({ data: [row()], error: null })

        const result = await deliverNotifications(makeSupabase(), sender, { appUrl: 'https://ritual.app' })

        expect(rpc).toHaveBeenCalledWith('claim_pending_notifications', { batch_size: 50, only_ids: null })
        expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@b.com', subject: 'Hola' }))
        expect(update).toHaveBeenCalledWith(expect.objectContaining({ email_status: 'sent', email_last_error: null }))
        expect(result).toEqual({ ok: true, details: { claimed: 1, sent: 1, retried: 0, failed: 0 } })
    })

    it('limits the claim to the given ids for immediate delivery', async () => {
        rpc.mockResolvedValue({ data: [], error: null })

        await deliverNotifications(makeSupabase(), sender, { onlyIds: ['n1'], appUrl: 'https://x' })

        expect(rpc).toHaveBeenCalledWith('claim_pending_notifications', { batch_size: 50, only_ids: ['n1'] })
    })

    it('keeps the row pending and releases the claim when a send fails before the attempt cap', async () => {
        rpc.mockResolvedValue({ data: [row({ email_attempts: 1 })], error: null })
        vi.mocked(sender.send).mockRejectedValue(new Error('Resend 500: down'))

        const result = await deliverNotifications(makeSupabase(), sender, { appUrl: 'https://x' })

        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({ email_status: 'pending', email_last_error: 'Resend 500: down', email_claimed_at: null })
        )
        expect(result.details).toMatchObject({ sent: 0, retried: 1, failed: 0 })
    })

    it('marks the row failed once the attempt cap is reached', async () => {
        rpc.mockResolvedValue({ data: [row({ email_attempts: 3 })], error: null })
        vi.mocked(sender.send).mockRejectedValue(new Error('still down'))

        const result = await deliverNotifications(makeSupabase(), sender, { appUrl: 'https://x' })

        expect(update).toHaveBeenCalledWith(expect.objectContaining({ email_status: 'failed' }))
        expect(result.details).toMatchObject({ retried: 0, failed: 1 })
    })

    it('fails the row for good when the user has no email address', async () => {
        rpc.mockResolvedValue({ data: [row()], error: null })
        getUserById.mockResolvedValue({ data: { user: { email: null } }, error: null })

        const result = await deliverNotifications(makeSupabase(), sender, { appUrl: 'https://x' })

        expect(sender.send).not.toHaveBeenCalled()
        expect(update).toHaveBeenCalledWith(expect.objectContaining({ email_status: 'failed', email_last_error: 'no_email' }))
        expect(result.details.failed).toBe(1)
    })

    it('reports not-ok when the claim itself fails', async () => {
        rpc.mockResolvedValue({ data: null, error: { message: 'rpc down' } })

        const result = await deliverNotifications(makeSupabase(), sender, { appUrl: 'https://x' })

        expect(result.ok).toBe(false)
        expect(sender.send).not.toHaveBeenCalled()
    })

    it('stops sending once the run budget is spent', async () => {
        rpc.mockResolvedValue({ data: [row({ id: 'n1' }), row({ id: 'n2' })], error: null })
        const now = vi.fn().mockReturnValueOnce(0).mockReturnValue(1_000)

        const result = await deliverNotifications(makeSupabase(), sender, {
            appUrl: 'https://x',
            runStart: new Date(0),
            budgetMs: 500,
            now,
        })

        expect(sender.send).toHaveBeenCalledTimes(1)
        expect(result.details.stopped_reason).toBe('deadline')
    })
})
