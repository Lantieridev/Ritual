import { NextResponse } from 'next/server'
import { authorizeCron, createCronSupabase, recordCronRun } from '@/src/core/lib/cron'
import { getNotificationsFromEmail, getResendApiKey } from '@/src/core/lib/env'
import { createResendSender } from '@/src/domains/notifications/email/resend'
import { deliverNotifications } from '@/src/domains/notifications/jobs/deliverNotifications'

export const maxDuration = 300 // Vercel Hobby's function ceiling (verified: functions.limitations)

// El schedule vive en `vercel.json` (`0 17 * * *`): una hora DESPUÉS de
// notify-post-show (`0 16`), porque en Hobby un cron corre "en algún momento de
// la hora indicada" y dos crons en la misma hora no tienen orden garantizado.

export async function GET(request: Request) {
    const auth = authorizeCron(request)
    if (!auth.ok) return auth.response

    const apiKey = getResendApiKey()
    const from = getNotificationsFromEmail()
    if (!apiKey || !from) {
        console.error('RESEND_API_KEY o NOTIFICATIONS_FROM_EMAIL no están configurados: se rechaza la corrida.')
        return NextResponse.json({ error: 'Email not configured' }, { status: 503 })
    }

    const supabase = createCronSupabase()
    if (!supabase) return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })

    const startedAt = new Date()
    const result = await deliverNotifications(supabase, createResendSender(apiKey, from), { runStart: startedAt })

    await recordCronRun(supabase, {
        job: 'deliver-notifications',
        startedAt,
        ok: result.ok,
        details: result.details,
    })

    return NextResponse.json({ success: result.ok, ...result.details })
}
