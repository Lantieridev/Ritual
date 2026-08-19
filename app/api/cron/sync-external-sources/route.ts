import { NextResponse } from 'next/server'
import { externalAdapters } from '@/src/core/lib/external-sources/adapters'
import { authorizeCron, createCronSupabase, recordCronRun } from '@/src/core/lib/cron'

function slugify(text: string) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
}

export const maxDuration = 300 // 5 minutes max duration for vercel cron

/**
 * El schedule vive en `vercel.json` (`0 7 * * *`, diario). Se documenta acá
 * porque el esquema de Vercel rechaza claves extra dentro de `crons` y JSON no
 * admite comentarios.
 *
 * Diario y no más seguido por dos razones: el plan Hobby dispara los crons una
 * vez por día, y el TTL del cache es de 7 días, así que una corrida diaria lo
 * mantiene fresco con margen. En Pro se puede pasar a cada seis horas.
 */

export async function GET(request: Request) {
  const auth = authorizeCron(request)
  if (!auth.ok) return auth.response

  const supabase = createCronSupabase()
  if (!supabase) return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })

  const startedAt = new Date()

  const results = await Promise.allSettled(
    externalAdapters.map(adapter => adapter.search({})) // Empty query fetches next upcoming events
  )

  let insertedCount = 0
  let failedCount = 0
  const failedAdapterIds: string[] = []

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
      failedAdapterIds.push(adapter.id)
      console.error(`Adapter ${adapter.id} failed:`, result.status === 'rejected' ? result.reason : result.value.error)
    }
  }

  // Todos los adaptadores fallando es la señal de una caída real (ej. el
  // formato de un sitio scrapeado cambió), no ruido de una sola fuente
  // inestable. Se persiste la corrida para poder detectarlo sin depender de
  // revisar logs de Vercel a mano — no hay Sentry/Datadog integrados acá.
  const ok = failedCount < externalAdapters.length
  await recordCronRun(supabase, {
    job: 'sync-external-sources',
    startedAt,
    ok,
    legacy: {
      adaptersTotal: externalAdapters.length,
      adaptersFailed: failedCount,
      failedAdapterIds,
      eventsInserted: insertedCount,
    },
  })

  return NextResponse.json({
    success: ok,
    inserted: insertedCount,
    failedAdapters: failedCount
  })
}
