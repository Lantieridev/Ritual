import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveChannels, type NotificationType } from './types'

export interface NotifyInput {
    userId: string
    type: NotificationType
    title: string
    body: string
    payload?: Record<string, unknown>
    /** Same (userId, dedupeKey) is inserted at most once, so a retried cron never double-notifies. */
    dedupeKey?: string
}

export type NotifyOutcome = 'created' | 'duplicate' | 'suppressed' | 'failed'

const UNIQUE_VIOLATION = '23505'

/**
 * The single entry point every producer uses. Reads the user's per-type
 * preference, then inserts one row that is both the inbox entry and the email
 * job. Requires a service-role client: there is no insert policy for users.
 *
 * Never throws: losing a notification must not break the action that
 * triggered it (rejecting an entry, saving a rating, ...).
 */
export async function notify(
    supabase: SupabaseClient,
    input: NotifyInput
): Promise<{ outcome: NotifyOutcome; id?: string }> {
    try {
        const { data: prefRow, error: prefError } = await supabase
            .from('notification_preferences')
            .select('in_app, email')
            .eq('user_id', input.userId)
            .eq('type', input.type)
            .maybeSingle()
        // A failed preference read degrades to the defaults instead of dropping the notice.
        if (prefError) console.error('notify: could not read preferences, using defaults:', prefError)

        const channels = resolveChannels(prefError ? null : prefRow)
        if (!channels.inApp && !channels.email) return { outcome: 'suppressed' }

        const { data, error } = await supabase
            .from('notifications')
            .insert({
                user_id: input.userId,
                type: input.type,
                title: input.title,
                body: input.body,
                payload: input.payload ?? {},
                dedupe_key: input.dedupeKey ?? null,
                in_app: channels.inApp,
                email_status: channels.email ? 'pending' : 'skipped',
            })
            .select('id')
            .single()

        if (error) {
            if (error.code === UNIQUE_VIOLATION) return { outcome: 'duplicate' }
            console.error('notify: insert failed:', error)
            return { outcome: 'failed' }
        }
        return { outcome: 'created', id: data.id as string }
    } catch (error) {
        console.error('notify: unexpected failure:', error)
        return { outcome: 'failed' }
    }
}
