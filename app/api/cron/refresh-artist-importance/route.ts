import { NextResponse } from 'next/server'
import { authorizeCron, createCronSupabase, recordCronRun } from '@/src/core/lib/cron'
import { refreshArtistImportance } from '@/src/domains/taste/jobs/refreshArtistImportance'

export const maxDuration = 300 // Vercel Hobby's function ceiling (verified: functions.limitations)

// El schedule vive en `vercel.json` (`0 4 * * *`, diario) — a las 4am, separado
// del `0 7` existente y del `0 13` de refresh-lastfm-imports (unit 11).

export async function GET(request: Request) {
    const auth = authorizeCron(request)
    if (!auth.ok) return auth.response

    const supabase = createCronSupabase()
    if (!supabase) return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })

    const startedAt = new Date()
    const result = await refreshArtistImportance(supabase, { runStart: startedAt })

    await recordCronRun(supabase, {
        job: 'refresh-artist-importance',
        startedAt,
        ok: result.ok,
        details: result.details,
    })

    return NextResponse.json({ success: result.ok, ...result.details })
}
