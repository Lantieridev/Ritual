import { getCurrentUserId } from '@/src/core/auth/session'
import type { ActionResult } from '@/src/core/types'
import {
    listNotifications,
    countUnread,
    markRead,
    listPreferenceRows,
    upsertPreference,
} from './data'
import type { NotificationItem } from './data'
import {
    NOTIFICATION_TYPES,
    NOTIFICATION_TYPE_LABELS,
    resolveChannels,
    type ChannelPreference,
    type NotificationType,
} from './types'

export type { NotificationItem }

export interface NotificationPreferenceView extends ChannelPreference {
    type: NotificationType
    label: string
    description: string
}

const NOT_AUTHENTICATED = 'No estás autenticado.'
const DEFAULT_LIMIT = 50

/**
 * Use-case layer: derives the acting user from the session (never from a
 * caller-supplied id), same pattern as `taste/service.ts`.
 */
export async function listMyNotifications(limit = DEFAULT_LIMIT): Promise<NotificationItem[]> {
    const userId = await getCurrentUserId()
    if (!userId) return []
    return listNotifications(userId, limit)
}

/** Feeds the navbar badge on every page: must never break the layout, so it degrades to 0. */
export async function countMyUnreadNotifications(): Promise<number> {
    const userId = await getCurrentUserId()
    if (!userId) return 0
    try {
        return await countUnread(userId)
    } catch (error) {
        console.error('countMyUnreadNotifications failed:', error)
        return 0
    }
}

export async function markMyNotificationsRead(ids?: string[]): Promise<ActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) return { error: NOT_AUTHENTICATED }
    try {
        await markRead(userId, ids)
        return {}
    } catch (error) {
        console.error('markMyNotificationsRead failed:', error)
        return { error: 'No pudimos marcar tus avisos como leídos.' }
    }
}

export async function getMyNotificationPreferences(): Promise<NotificationPreferenceView[]> {
    const userId = await getCurrentUserId()
    if (!userId) return []
    const rows = await listPreferenceRows(userId)
    return NOTIFICATION_TYPES.map((type) => ({
        type,
        ...NOTIFICATION_TYPE_LABELS[type],
        ...resolveChannels(rows.find((row) => row.type === type)),
    }))
}

export async function updateMyNotificationPreference(
    type: NotificationType,
    channels: ChannelPreference
): Promise<ActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) return { error: NOT_AUTHENTICATED }
    try {
        await upsertPreference(userId, type, channels)
        return {}
    } catch (error) {
        console.error('updateMyNotificationPreference failed:', error)
        return { error: 'No pudimos guardar tus preferencias.' }
    }
}
