/**
 * Daily post-show reminder (issue #9's "single notice with everything
 * pending"). Looks at the shows of the previous Argentine calendar day, and for
 * every user who marked `going`/`went`, reuses the pure `computePendingForShow`
 * rule. One notification per (user, show), deduped by `post_show:{event_id}`.
 */
import 'server-only'
import { RUN_BUDGET_MS, type CronSupabaseClient } from '@/src/core/lib/cron'
import { computePendingForShow } from '@/src/domains/showmode/pending'
import { notify } from '../notify'

// Buenos Aires is UTC-3 all year (no DST since 2009), so a fixed offset is exact.
const AR_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function argentinaYesterday(now: Date): { date: string; startIso: string; endIso: string } {
    const argentinaNow = new Date(now.getTime() - AR_OFFSET_MS)
    const startOfTodayAr = Date.UTC(argentinaNow.getUTCFullYear(), argentinaNow.getUTCMonth(), argentinaNow.getUTCDate())
    const start = startOfTodayAr - DAY_MS
    return {
        date: new Date(start).toISOString().slice(0, 10),
        startIso: new Date(start + AR_OFFSET_MS).toISOString(),
        endIso: new Date(startOfTodayAr + AR_OFFSET_MS).toISOString(),
    }
}

export interface NotifyPostShowDetails {
    events: number
    candidates: number
    created: number
    duplicates: number
    suppressed: number
    failed: number
    complete: number
    stopped_reason?: 'deadline'
}

export interface NotifyPostShowOptions {
    now?: Date
    runStart?: Date
    budgetMs?: number
    clock?: () => number
}

interface EventRow {
    id: string
    name: string | null
}
interface AttendanceRow {
    user_id: string
    event_id: string
    status: 'interested' | 'going' | 'went'
    rating: number | null
    review: string | null
}

export async function notifyPostShow(
    supabase: CronSupabaseClient,
    options: NotifyPostShowOptions = {}
): Promise<{ ok: boolean; details: NotifyPostShowDetails }> {
    const details: NotifyPostShowDetails = {
        events: 0, candidates: 0, created: 0, duplicates: 0, suppressed: 0, failed: 0, complete: 0,
    }
    const clock = options.clock ?? Date.now
    const runStart = options.runStart ?? new Date(clock())
    const budgetMs = options.budgetMs ?? RUN_BUDGET_MS
    const window = argentinaYesterday(options.now ?? new Date())

    const { data: eventRows, error: eventsError } = await supabase
        .from('events')
        .select('id, name')
        .gte('date', window.startIso)
        .lt('date', window.endIso)
    if (eventsError) {
        console.error('notifyPostShow: could not read events:', eventsError)
        return { ok: false, details }
    }

    const events = (eventRows ?? []) as EventRow[]
    details.events = events.length
    if (events.length === 0) return { ok: true, details }

    const eventIds = events.map((event) => event.id)
    const [attendanceResult, expensesResult] = await Promise.all([
        supabase
            .from('attendance')
            .select('user_id, event_id, status, rating, review')
            .in('event_id', eventIds)
            .in('status', ['going', 'went']),
        supabase.from('expenses').select('user_id, event_id').in('event_id', eventIds),
    ])
    if (attendanceResult.error || expensesResult.error) {
        console.error('notifyPostShow: could not read attendance/expenses:', attendanceResult.error ?? expensesResult.error)
        return { ok: false, details }
    }

    const expenseCounts = new Map<string, number>()
    for (const expense of (expensesResult.data ?? []) as Array<{ user_id: string; event_id: string }>) {
        const key = `${expense.user_id}:${expense.event_id}`
        expenseCounts.set(key, (expenseCounts.get(key) ?? 0) + 1)
    }
    const eventNames = new Map(events.map((event) => [event.id, event.name ?? 'tu show']))

    const attendances = (attendanceResult.data ?? []) as AttendanceRow[]
    details.candidates = attendances.length

    for (const attendance of attendances) {
        if (clock() - runStart.getTime() >= budgetMs) {
            details.stopped_reason = 'deadline'
            break
        }

        const pending = computePendingForShow({
            attendanceStatus: attendance.status,
            expenseCount: expenseCounts.get(`${attendance.user_id}:${attendance.event_id}`) ?? 0,
            rating: attendance.rating,
            review: attendance.review,
        })
        if (pending.length === 0) {
            details.complete++
            continue
        }

        const { outcome } = await notify(supabase, {
            userId: attendance.user_id,
            type: 'post_show_reminder',
            title: `Te faltan datos de ${eventNames.get(attendance.event_id)}`,
            body: pending.map((item) => item.label).join('\n'),
            payload: { eventId: attendance.event_id, pending: pending.map((item) => item.kind) },
            dedupeKey: `post_show:${attendance.event_id}`,
        })
        if (outcome === 'created') details.created++
        else if (outcome === 'duplicate') details.duplicates++
        else if (outcome === 'suppressed') details.suppressed++
        else details.failed++
    }

    return { ok: true, details }
}
