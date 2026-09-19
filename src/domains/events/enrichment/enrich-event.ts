import { isTicketmasterConfigured, searchTicketmasterEvents } from '@/src/core/lib/ticketmaster'
import type { createClient } from '@/src/core/lib/supabase/server'
import { findConfidentMatch, hasRealTime } from './match'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

interface EventRow {
  id: string
  name: string | null
  date: string
  time_known: boolean
  poster_url: string | null
  venues: { name: string; city: string | null } | null
  lineups: Array<{
    is_headliner?: boolean | null
    artists: { id: string; name: string; genre: string | null } | null
  }> | null
}

const EVENT_SELECT = `
  id, name, date, time_known, poster_url,
  venues ( name, city ),
  lineups ( is_headliner, artists ( id, name, genre ) )
`

/**
 * Completa en silencio la hora real, el póster y el género de un show recién
 * cargado a mano, a partir de Ticketmaster (issue #11). Corre desde `after()`,
 * cuando la respuesta al usuario ya salió, así que jamás debe lanzar: sin API
 * key, con la API caída o sin match no hace nada (ADR 0003).
 *
 * Sólo escribe campos vacíos, y cada escritura lleva su propia guarda en el
 * `where`: si el usuario edita el show entre el guardado y este job, gana el
 * usuario.
 */
export async function enrichEventFromExternal(supabase: SupabaseClient, eventId: string): Promise<void> {
  try {
    await enrich(supabase, eventId)
  } catch (error) {
    console.warn('Enriquecimiento del evento falló:', error)
  }
}

async function enrich(supabase: SupabaseClient, eventId: string): Promise<void> {
  if (!isTicketmasterConfigured()) return

  const { data, error } = await supabase.from('events').select(EVENT_SELECT).eq('id', eventId).single()
  const event = data as unknown as EventRow | null
  if (error || !event) {
    console.warn('Enriquecimiento: no se pudo leer el evento', eventId, error)
    return
  }

  const lineup = event.lineups ?? []
  const headliner = (lineup.find((row) => row.is_headliner) ?? lineup[0])?.artists ?? null
  const keyword = headliner?.name ?? event.name ?? undefined
  const city = event.venues?.city ?? undefined

  const { events: candidates, error: searchError } = await searchTicketmasterEvents({ keyword, city })
  if (searchError) {
    console.warn('Enriquecimiento: la búsqueda en Ticketmaster falló:', searchError)
    return
  }

  const match = findConfidentMatch(
    { date: event.date, venueName: event.venues?.name ?? null, venueCity: event.venues?.city ?? null },
    candidates
  )
  if (!match) return

  if (!event.time_known && hasRealTime(match)) {
    const { error: writeError } = await supabase
      .from('events')
      .update({ date: match.datetime, time_known: true })
      .eq('id', eventId)
      .eq('time_known', false)
    if (writeError) console.warn('Enriquecimiento: no se pudo guardar la hora:', writeError)
  }

  if (!event.poster_url && match.image) {
    const { error: writeError } = await supabase
      .from('events')
      .update({ poster_url: match.image })
      .eq('id', eventId)
      .is('poster_url', null)
    if (writeError) console.warn('Enriquecimiento: no se pudo guardar el póster:', writeError)
  }

  if (headliner && !headliner.genre && match.genre) {
    // RPC acotada: un UPDATE directo sobre artists exigiría una policy que abre todas las columnas.
    const { error: writeError } = await supabase.rpc('fill_artist_genre', {
      p_artist_id: headliner.id,
      p_genre: match.genre,
    })
    if (writeError) console.warn('Enriquecimiento: no se pudo guardar el género:', writeError)
  }
}
