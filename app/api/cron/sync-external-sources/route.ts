import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { externalAdapters } from '@/src/core/lib/external-sources/adapters'

function slugify(text: string) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
}

export const maxDuration = 300 // 5 minutes max duration for vercel cron

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  // Basic security for cron (Vercel cron uses CRON_SECRET)
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const results = await Promise.allSettled(
    externalAdapters.map(adapter => adapter.search({})) // Empty query fetches next upcoming events
  )

  let insertedCount = 0
  let failedCount = 0

  for (let i = 0; i < externalAdapters.length; i++) {
    const adapter = externalAdapters[i]
    const result = results[i]

    if (result.status === 'fulfilled' && !result.value.error) {
      const { events } = result.value
      
      for (const event of events) {
        // Dedup key: slugify(artist) + '-' + date(YYYY-MM-DD)
        const dateStr = event.datetime ? event.datetime.split('T')[0] : 'nodate'
        const dedupKey = `${slugify(event.title)}-${dateStr}`
        
        // Expires in 7 days
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 7)

        const { error } = await supabase.from('external_events_cache').upsert({
          source_id: adapter.id,
          dedup_key: dedupKey,
          event_data: event,
          expires_at: expiresAt.toISOString()
        }, { onConflict: 'source_id, dedup_key' })

        if (error) {
          console.error(`Failed to insert event for ${adapter.id}:`, error)
        } else {
          insertedCount++
        }
      }
    } else {
      failedCount++
      console.error(`Adapter ${adapter.id} failed:`, result.status === 'rejected' ? result.reason : result.value.error)
    }
  }

  return NextResponse.json({
    success: true,
    inserted: insertedCount,
    failedAdapters: failedCount
  })
}
