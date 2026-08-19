/**
 * Shared cron plumbing: bearer-secret authorization (fails closed), a
 * service-role Supabase client, and one `cron_runs` row per execution.
 * Extracted from sync-external-sources so the taste crons reuse the same
 * fail-closed guard instead of re-implementing it.
 */
import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type CronSupabaseClient = SupabaseClient

/** Leaves 60s of headroom under Vercel Hobby's 300s function ceiling (verified: functions.limitations). */
export const RUN_BUDGET_MS = 240_000

export type CronAuthResult = { ok: true } | { ok: false; response: NextResponse }

/** Constant-time comparison so the secret isn't leaked character-by-character via response timing. */
function secretMatches(provided: string, expected: string): boolean {
    const a = Buffer.from(provided)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
}

/** Fails closed: authorized only when CRON_SECRET is set AND the bearer header matches it — a missing secret is 503, never treated as "open". */
export function authorizeCron(request: Request): CronAuthResult {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
        console.error('CRON_SECRET no está configurado: se rechaza la corrida del cron.')
        return { ok: false, response: NextResponse.json({ error: 'Cron not configured' }, { status: 503 }) }
    }

    const authHeader = request.headers.get('authorization') ?? ''
    if (!authHeader.startsWith('Bearer ') || !secretMatches(authHeader.slice(7), cronSecret)) {
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    return { ok: true }
}

/** A service-role client, or null when the env isn't configured (caller should respond 503). */
export function createCronSupabase(): CronSupabaseClient | null {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para el cron.')
        return null
    }
    return createClient(supabaseUrl, supabaseServiceKey)
}

/** The legacy sync-external-sources counters — `not null` columns that now default to 0 for every other job. */
export interface CronRunLegacyCounters {
    adaptersTotal: number
    adaptersFailed: number
    failedAdapterIds: string[]
    eventsInserted: number
}

export interface RecordCronRunInput {
    job: string
    startedAt: Date
    ok: boolean
    /** Job-specific counters (see design "Details written per run"). Defaults to `{}`. */
    details?: object
    /** Only sync-external-sources still writes these; every other job leaves them at their 0 default. */
    legacy?: CronRunLegacyCounters
}

/** One `cron_runs` row per execution. Never throws — a failed insert is logged, not propagated. */
export async function recordCronRun(supabase: CronSupabaseClient, input: RecordCronRunInput): Promise<void> {
    const { error } = await supabase.from('cron_runs').insert({
        job: input.job,
        started_at: input.startedAt.toISOString(),
        ok: input.ok,
        details: input.details ?? {},
        adapters_total: input.legacy?.adaptersTotal ?? 0,
        adapters_failed: input.legacy?.adaptersFailed ?? 0,
        failed_adapter_ids: input.legacy?.failedAdapterIds ?? [],
        events_inserted: input.legacy?.eventsInserted ?? 0,
    })
    if (error) console.error('No se pudo persistir la corrida del cron:', error)
}
