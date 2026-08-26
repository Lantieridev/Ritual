import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { externalAdapters } from '@/src/core/lib/external-sources/adapters'

function slugify(text: string) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
}

export const maxDuration = 300 // 5 minutes max duration for vercel cron

/**
 * Comparación en tiempo constante para no filtrar el secreto carácter por
 * carácter vía el tiempo de respuesta. `timingSafeEqual` exige buffers del
 * mismo largo, así que la diferencia de longitud se chequea aparte.
 */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  // Falla cerrado: sin CRON_SECRET configurado el endpoint queda inaccesible en
  // vez de abierto. Antes la guarda era `if (CRON_SECRET && ...)`, así que un
  // olvido de la variable en el entorno saltaba el chequeo entero y dejaba la
  // ruta pública corriendo con la service role key, que bypassa RLS.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('CRON_SECRET no está configurado: se rechaza la corrida del cron.')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ') || !secretMatches(authHeader.slice(7), cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para el cron.')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
  }
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
