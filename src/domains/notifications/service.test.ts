import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCurrentUserId = vi.fn()
vi.mock('@/src/core/auth/session', () => ({ getCurrentUserId: () => getCurrentUserId() }))
vi.mock('@/src/core/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({}) }))

const data = {
    listNotifications: vi.fn(),
    countUnread: vi.fn(),
    markRead: vi.fn(),
    listPreferenceRows: vi.fn(),
    upsertPreference: vi.fn(),
}
vi.mock('./data', () => ({
    listNotifications: (...a: unknown[]) => data.listNotifications(...a),
    countUnread: (...a: unknown[]) => data.countUnread(...a),
    markRead: (...a: unknown[]) => data.markRead(...a),
    listPreferenceRows: (...a: unknown[]) => data.listPreferenceRows(...a),
    upsertPreference: (...a: unknown[]) => data.upsertPreference(...a),
}))

import {
    listMyNotifications,
    countMyUnreadNotifications,
    markMyNotificationsRead,
    getMyNotificationPreferences,
    updateMyNotificationPreference,
} from './service'

describe('notifications service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, 'error').mockImplementation(() => {})
        getCurrentUserId.mockResolvedValue('u1')
    })

    it('returns nothing for a signed-out visitor', async () => {
        getCurrentUserId.mockResolvedValue(null)

        expect(await listMyNotifications()).toEqual([])
        expect(await countMyUnreadNotifications()).toBe(0)
        expect(await getMyNotificationPreferences()).toEqual([])
        expect(await markMyNotificationsRead()).toEqual({ error: 'No estás autenticado.' })
        expect(await updateMyNotificationPreference('admin_message', { inApp: true, email: true })).toEqual({
            error: 'No estás autenticado.',
        })
    })

    it('lists the signed-in user notifications', async () => {
        data.listNotifications.mockResolvedValue([{ id: 'n1' }])

        expect(await listMyNotifications(10)).toEqual([{ id: 'n1' }])
        expect(data.listNotifications).toHaveBeenCalledWith('u1', 10)
    })

    it('counts unread and degrades to 0 when the read fails', async () => {
        data.countUnread.mockResolvedValueOnce(4).mockRejectedValueOnce(new Error('db'))

        expect(await countMyUnreadNotifications()).toBe(4)
        expect(await countMyUnreadNotifications()).toBe(0)
        expect(console.error).toHaveBeenCalled()
    })

    it('marks as read, reporting a database failure as an error result', async () => {
        data.markRead.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('db'))

        expect(await markMyNotificationsRead(['n1'])).toEqual({})
        expect(data.markRead).toHaveBeenCalledWith('u1', ['n1'])
        expect(await markMyNotificationsRead()).toEqual({ error: 'No pudimos marcar tus avisos como leídos.' })
    })

    it('merges stored preferences over the defaults for every type', async () => {
        data.listPreferenceRows.mockResolvedValue([{ type: 'admin_message', in_app: true, email: false }])

        const views = await getMyNotificationPreferences()

        expect(views.map((v) => v.type)).toEqual(['moderation_rejected', 'post_show_reminder', 'admin_message'])
        expect(views.find((v) => v.type === 'admin_message')).toMatchObject({ inApp: true, email: false })
        expect(views.find((v) => v.type === 'post_show_reminder')).toMatchObject({ inApp: true, email: true })
    })

    it('saves a preference for the signed-in user', async () => {
        data.upsertPreference.mockResolvedValue(undefined)

        expect(await updateMyNotificationPreference('post_show_reminder', { inApp: false, email: true })).toEqual({})
        expect(data.upsertPreference).toHaveBeenCalledWith('u1', 'post_show_reminder', { inApp: false, email: true })
    })

    it('reports a failed preference save as an error result', async () => {
        data.upsertPreference.mockRejectedValue(new Error('db'))

        expect(await updateMyNotificationPreference('admin_message', { inApp: true, email: true })).toEqual({
            error: 'No pudimos guardar tus preferencias.',
        })
    })
})
