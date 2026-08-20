import { NextResponse } from 'next/server'
import { authorizeCron, createCronSupabase, recordCronRun } from '@/src/core/lib/cron'
import { refreshLastfmImports } from '@/src/domains/taste/jobs/refreshLastfmImports'

export const maxDuration = 300 // Vercel Hobby's function ceiling (verified: functions.limitations)

// El schedule vive en `vercel.json` (`0 13 * * *`, diario) — a las 13hs, 9h
// separado del `0 4` de refresh-artist-importance (el otro cron que llama a
// Last.fm), sin problema bajo la precisión de ±59min del plan Hobby.

export async function GET(request: Request) {
    const auth = authorizeCron(request)
    if (!auth.ok) return auth.response

    const supabase = createCronSupabase()
    if (!supabase) return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })

    const startedAt = new Date()
    const result = await refreshLastfmImports(supabase, { runStart: startedAt })

    await recordCronRun(supabase, {
        job: 'refresh-lastfm-imports',
        startedAt,
        ok: result.ok,
        details: result.details,
    })

    return NextResponse.json({ success: result.ok, ...result.details })
}
