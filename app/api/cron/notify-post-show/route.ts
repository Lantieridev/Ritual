import { NextResponse } from 'next/server'
import { authorizeCron, createCronSupabase, recordCronRun } from '@/src/core/lib/cron'
import { notifyPostShow } from '@/src/domains/notifications/jobs/notifyPostShow'

export const maxDuration = 300 // Vercel Hobby's function ceiling (verified: functions.limitations)

// El schedule vive en `vercel.json` (`0 16 * * *` UTC = 13:00 en Argentina): a esa
// hora el usuario ya durmió y el show fue "ayer". deliver-notifications corre
// una hora después para drenar lo que este job encola.

export async function GET(request: Request) {
    const auth = authorizeCron(request)
    if (!auth.ok) return auth.response

    const supabase = createCronSupabase()
    if (!supabase) return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })

    const startedAt = new Date()
    const result = await notifyPostShow(supabase, { runStart: startedAt })

    await recordCronRun(supabase, {
        job: 'notify-post-show',
        startedAt,
        ok: result.ok,
        details: result.details,
    })

    return NextResponse.json({ success: result.ok, ...result.details })
}
