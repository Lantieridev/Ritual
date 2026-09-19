import { describe, it, expect, vi, beforeEach } from 'vitest'

const after = vi.fn()
vi.mock('next/server', () => ({ after: (fn: () => unknown) => after(fn) }))

const createServiceClient = vi.fn()
vi.mock('@/src/core/lib/supabase/service', () => ({ createServiceClient: () => createServiceClient() }))

const notify = vi.fn()
vi.mock('./notify', () => ({ notify: (...a: unknown[]) => notify(...a) }))

const deliverNotifications = vi.fn()
vi.mock('./jobs/deliverNotifications', () => ({ deliverNotifications: (...a: unknown[]) => deliverNotifications(...a) }))

import { sendAdminMessage } from './adminMessage'

describe('sendAdminMessage', () => {
    const client = { service: true }

    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.stubEnv('RESEND_API_KEY', 're_key')
        vi.stubEnv('NOTIFICATIONS_FROM_EMAIL', 'Ritual <a@r.app>')
        createServiceClient.mockReturnValue(client)
        notify.mockResolvedValue({ outcome: 'created', id: 'n1' })
    })

    it('creates the notification and schedules an immediate email attempt', async () => {
        const result = await sendAdminMessage({ userId: 'u2', title: 'Aviso', body: 'Texto' })

        expect(result).toEqual({})
        expect(notify).toHaveBeenCalledWith(client, { userId: 'u2', type: 'admin_message', title: 'Aviso', body: 'Texto' })
        expect(after).toHaveBeenCalledTimes(1)

        await after.mock.calls[0][0]()
        expect(deliverNotifications).toHaveBeenCalledWith(client, expect.anything(), { onlyIds: ['n1'] })
    })

    it('still succeeds without scheduling delivery when email is not configured (the cron will retry)', async () => {
        vi.stubEnv('RESEND_API_KEY', '')

        expect(await sendAdminMessage({ userId: 'u2', title: 'Aviso', body: 'Texto' })).toEqual({})
        expect(after).not.toHaveBeenCalled()
    })

    it('rejects blank titles and bodies', async () => {
        expect(await sendAdminMessage({ userId: 'u2', title: '  ', body: 'x' })).toEqual({ error: 'El título es obligatorio.' })
        expect(await sendAdminMessage({ userId: 'u2', title: 'x', body: '' })).toEqual({ error: 'El mensaje es obligatorio.' })
        expect(notify).not.toHaveBeenCalled()
    })

    it('reports when the service client is unavailable or notify fails', async () => {
        createServiceClient.mockReturnValueOnce(null)
        expect(await sendAdminMessage({ userId: 'u2', title: 'x', body: 'y' })).toEqual({
            error: 'El servicio de avisos no está configurado.',
        })

        notify.mockResolvedValueOnce({ outcome: 'failed' })
        expect(await sendAdminMessage({ userId: 'u2', title: 'x', body: 'y' })).toEqual({
            error: 'No pudimos enviar el mensaje.',
        })
    })

    it('reports when the recipient turned every channel off', async () => {
        notify.mockResolvedValueOnce({ outcome: 'suppressed' })

        expect(await sendAdminMessage({ userId: 'u2', title: 'x', body: 'y' })).toEqual({
            error: 'La persona desactivó este tipo de aviso.',
        })
    })
})
