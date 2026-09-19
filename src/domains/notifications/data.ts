import { createClient } from '@/src/core/lib/supabase/server'
import type { ChannelPreference, NotificationType } from './types'

export interface NotificationItem {
    id: string
    type: NotificationType
    title: string
    body: string
    readAt: string | null
    createdAt: string
}

export interface PreferenceRow {
    type: NotificationType
    in_app: boolean
    email: boolean
}

/** All reads and writes here run with the user's JWT, so RLS scopes them to the owner. */
export async function listNotifications(userId: string, limit: number): Promise<NotificationItem[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, read_at, created_at')
        .eq('user_id', userId)
        .eq('in_app', true)
        .order('created_at', { ascending: false })
        .limit(limit)
    if (error) throw error

    return (data ?? []).map((row) => ({
        id: row.id as string,
        type: row.type as NotificationType,
        title: row.title as string,
        body: row.body as string,
        readAt: (row.read_at as string | null) ?? null,
        createdAt: row.created_at as string,
    }))
}

export async function countUnread(userId: string): Promise<number> {
    const supabase = await createClient()
    const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('in_app', true)
        .is('read_at', null)
    if (error) throw error
    return count ?? 0
}

/** `ids` omitted marks every unread notification of the user as read. */
export async function markRead(userId: string, ids?: string[]): Promise<void> {
    const supabase = await createClient()
    let query = supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('in_app', true)
        .is('read_at', null)
    if (ids) query = query.in('id', ids)
    const { error } = await query
    if (error) throw error
}

export async function listPreferenceRows(userId: string): Promise<PreferenceRow[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('notification_preferences')
        .select('type, in_app, email')
        .eq('user_id', userId)
    if (error) throw error
    return (data ?? []) as PreferenceRow[]
}

export async function upsertPreference(userId: string, type: NotificationType, channels: ChannelPreference): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.from('notification_preferences').upsert(
        { user_id: userId, type, in_app: channels.inApp, email: channels.email, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,type' }
    )
    if (error) throw error
}
