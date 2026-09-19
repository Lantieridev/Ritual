/**
 * Drains the email queue: claims pending notifications atomically, sends each
 * one and records the outcome. A failed send stays `pending` (and is retried by
 * the next run) until MAX_EMAIL_ATTEMPTS, then becomes `failed`. The in-app
 * inbox is unaffected either way.
 */
import 'server-only'
import { RUN_BUDGET_MS, type CronSupabaseClient } from '@/src/core/lib/cron'
import type { EmailSender } from '../email/types'
import { renderNotificationEmail } from '../email/render'

export const MAX_EMAIL_ATTEMPTS = 3
const DEFAULT_BATCH_SIZE = 50

export interface DeliverNotificationsDetails {
    claimed: number
    sent: number
    retried: number
    failed: number
    stopped_reason?: 'deadline'
}

export interface DeliverNotificationsOptions {
    /** Immediate delivery of specific rows (used by `after()`); omitted for the daily drain. */
    onlyIds?: string[]
    batchSize?: number
    appUrl?: string
    runStart?: Date
    budgetMs?: number
    now?: () => number
}

interface ClaimedRow {
    id: string
    user_id: string
    title: string
    body: string
    email_attempts: number
}

export async function deliverNotifications(
    supabase: CronSupabaseClient,
    sender: EmailSender,
    options: DeliverNotificationsOptions = {}
): Promise<{ ok: boolean; details: DeliverNotificationsDetails }> {
    const details: DeliverNotificationsDetails = { claimed: 0, sent: 0, retried: 0, failed: 0 }
    const now = options.now ?? Date.now
    const runStart = options.runStart ?? new Date(now())
    const budgetMs = options.budgetMs ?? RUN_BUDGET_MS
    const appUrl = options.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? ''

    const { data, error } = await supabase.rpc('claim_pending_notifications', {
        batch_size: options.batchSize ?? DEFAULT_BATCH_SIZE,
        only_ids: options.onlyIds ?? null,
    })
    if (error) {
        console.error('deliverNotifications: claim failed:', error)
        return { ok: false, details }
    }

    const rows = (data ?? []) as ClaimedRow[]
    details.claimed = rows.length

    for (const row of rows) {
        if (now() - runStart.getTime() >= budgetMs) {
            details.stopped_reason = 'deadline'
            break
        }
        await deliverRow(supabase, sender, row, appUrl, details)
    }

    return { ok: true, details }
}

async function deliverRow(
    supabase: CronSupabaseClient,
    sender: EmailSender,
    row: ClaimedRow,
    appUrl: string,
    details: DeliverNotificationsDetails
): Promise<void> {
    const { data: userData } = await supabase.auth.admin.getUserById(row.user_id)
    const to = userData?.user?.email
    if (!to) {
        await record(supabase, row.id, { email_status: 'failed', email_last_error: 'no_email' })
        details.failed++
        return
    }

    try {
        await sender.send({ to, ...renderNotificationEmail({ title: row.title, body: row.body, appUrl }) })
        await record(supabase, row.id, {
            email_status: 'sent',
            email_sent_at: new Date().toISOString(),
            email_last_error: null,
        })
        details.sent++
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const exhausted = row.email_attempts >= MAX_EMAIL_ATTEMPTS
        await record(supabase, row.id, {
            email_status: exhausted ? 'failed' : 'pending',
            email_last_error: message,
            email_claimed_at: null,
        })
        if (exhausted) details.failed++
        else details.retried++
    }
}

async function record(supabase: CronSupabaseClient, id: string, patch: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from('notifications').update(patch).eq('id', id)
    if (error) console.error('deliverNotifications: could not record outcome:', error)
}
