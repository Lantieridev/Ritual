import { createClient } from '@/src/core/lib/supabase/server'
import { validateUUID, validateDate, sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import { findOrCreateByName } from '@/src/core/lib/find-or-create'
import { getCurrentUserId } from '@/src/core/auth/session'
import type { ActionResult, EventCreateInput, EventUpdateInput, FutureEvent } from '@/src/core/types'

/**
 * Capa de casos de uso del dominio de eventos.
 *
 * El lado de escritura vive acá desde que se borró actions.ts (issue #23):
 * GraphQL es el único transporte de las mutations de eventos, así que las
 * funciones sin redirect que antes respaldaban tanto a la Server Action como
 * al resolver quedaron con un solo caller, y este es su lugar.
 *
 * Los wrappers que redirigían (createEvent/updateEvent/deleteEvent) no se
 * portaron: la navegación después de guardar la decide ahora el client
 * component que dispara la mutation, con router.push().
 */

const MAX_NAME_LENGTH = 200
const MAX_VENUE_NAME_LENGTH = 200
const MAX_ARTIST_NAME_LENGTH = 200
const MAX_LOCATION_LENGTH = 100
const MAX_NOTES_LENGTH = 5000

function validateCreate(data: EventCreateInput): string | null {
  const name = sanitizeText(data.name, MAX_NAME_LENGTH)
  if (!name) return 'El nombre del recital es obligatorio.'
  const dateErr = validateDate(data.date)
  if (dateErr) return dateErr
  if (!data.venue_id) return 'Debes elegir una sede.'
  const venueIdErr = validateUUID(data.venue_id, 'Sede')
  if (venueIdErr) return venueIdErr
  return null
}

/**
 * Inserta el evento (y su lineup, si se pasan artist_ids) y devuelve su id
 * — sin redirigir, misma razón que en los demás dominios: la mutation de
 * GraphQL nunca debería redirigir.
 */
export async function insertEvent(formData: EventCreateInput): Promise<ActionResult<{ id?: string }>> {
  const userId = await getCurrentUserId()
  if (!userId) return { error: 'Usuario no autenticado' }

  const err = validateCreate(formData)
  if (err) return { error: err }

  const name = sanitizeText(formData.name, MAX_NAME_LENGTH)!

  const supabase = await createClient()
  const { data: newEvent, error } = await supabase
    .from('events')
    .insert({
      name,
      date: formData.date,
      venue_id: formData.venue_id,
      ticket_url: formData.ticket_url?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !newEvent) {
    console.error('Error creando evento:', error)
    return { error: sanitizeError(error) }
  }

  if (formData.artist_ids?.length) {
    // Validate all artist IDs are UUIDs before inserting
    const invalidId = formData.artist_ids.find((id) => validateUUID(id) !== null)
    if (invalidId) return { error: 'ID de artista inválido.' }

    const { error: lineupsError } = await supabase.from('lineups').insert(
      formData.artist_ids.map((artist_id) => ({ event_id: newEvent.id, artist_id }))
    )
    if (lineupsError) {
      console.error('Error creando lineups:', lineupsError)
      // El recital ya se guardó — no reportamos éxito silencioso de algo que
      // quedó a medio hacer. El usuario tiene que enterarse y completarlo.
      return {
        error: 'El recital se guardó, pero no se pudieron guardar los artistas del lineup. Editalo para agregarlos.',
        id: newEvent.id,
      }
    }
  }

  return { id: newEvent.id }
}

/**
 * Crea en nuestra base un recital a partir de un evento externo (Ticketmaster, Setlist.fm, Last.fm, etc.).
 * Busca o crea sede y artista para no duplicar.
 *
 * `notes` es opcional y se usa para el setlist real que trae Setlist.fm al
 * importar un show pasado — antes se mostraba y se descartaba, obligando a
 * reescribirlo a mano. Como un setlist solo existe para shows que ya
 * pasaron, la asistencia se crea directamente en 'went' para que las notas
 * queden visibles y editables sin un paso extra.
 */
export async function addExternalEvent(
  event: FutureEvent,
  artistNameForLineup?: string,
  notes?: string
): Promise<ActionResult<{ eventId?: string }>> {
  const userId = await getCurrentUserId()
  if (!userId) return { error: 'Usuario no autenticado' }

  const venueName = sanitizeText(event.venue?.name, MAX_VENUE_NAME_LENGTH)
  if (!venueName) return { error: 'El evento no tiene sede.' }

  const dateStr = event.datetime
  if (!dateStr) return { error: 'El evento no tiene fecha.' }

  const artistName =
    sanitizeText(artistNameForLineup, MAX_ARTIST_NAME_LENGTH) ||
    sanitizeText(event.lineup?.[0], MAX_ARTIST_NAME_LENGTH) ||
    sanitizeText(event.title, MAX_ARTIST_NAME_LENGTH) ||
    'Artista'

  const eventName = sanitizeText(event.title, MAX_NAME_LENGTH) || `${artistName} @ ${venueName}`

  const supabase = await createClient()

  const venue = await findOrCreateByName(supabase, 'venues', venueName, {
    city: sanitizeText(event.venue.city, MAX_LOCATION_LENGTH),
    country: sanitizeText(event.venue.country, MAX_LOCATION_LENGTH),
  })
  if ('error' in venue) return { error: venue.error }

  const artist = await findOrCreateByName(supabase, 'artists', artistName)
  if ('error' in artist) return { error: artist.error }

  const { data: newEvent, error: eventErr } = await supabase
    .from('events')
    .insert({
      name: eventName,
      date: dateStr,
      venue_id: venue.id,
    })
    .select('id')
    .single()

  if (eventErr || !newEvent) {
    console.error('Error creando evento:', eventErr)
    return { error: sanitizeError(eventErr) }
  }

  const { error: lineupErr } = await supabase
    .from('lineups')
    .insert({ event_id: newEvent.id, artist_id: artist.id })

  if (lineupErr) {
    console.error('Error creando lineup:', lineupErr)
    // El recital ya se guardó — no reportamos éxito silencioso de algo que
    // quedó a medio hacer. El usuario tiene que enterarse y completarlo.
    return {
      error: 'El recital se guardó, pero no se pudo guardar el artista del lineup. Editalo para agregarlo.',
      eventId: newEvent.id,
    }
  }

  const sanitizedNotes = sanitizeText(notes, MAX_NOTES_LENGTH)
  if (sanitizedNotes) {
    const { error: attendanceErr } = await supabase.from('attendance').upsert(
      { event_id: newEvent.id, user_id: userId, status: 'went', notes: sanitizedNotes },
      { onConflict: 'event_id,user_id' }
    )
    if (attendanceErr) {
      // No bloqueamos el alta por esto — el setlist es una comodidad, no
      // datos esenciales como el lineup. El usuario puede cargarlo a mano.
      console.error('Error guardando notas iniciales:', attendanceErr)
    }
  }

  // Return the new event ID — the client component handles navigation.
  // DO NOT call redirect() here: it throws NEXT_REDIRECT which useTransition
  // silently swallows, making the button appear to do nothing.
  return { eventId: newEvent.id }
}

/** Actualiza el evento (y su lineup) sin redirigir — misma razón que insertEvent. */
export async function modifyEvent(id: string, formData: EventUpdateInput): Promise<ActionResult> {
  const userId = await getCurrentUserId()
  if (!userId) return { error: 'Usuario no autenticado' }

  const idErr = validateUUID(id, 'Evento')
  if (idErr) return { error: idErr }

  // Validar todo antes de tocar la DB — evita instanciar un cliente para
  // una request que ya sabemos que va a fallar.
  if (formData.date !== undefined) {
    const dateErr = validateDate(formData.date)
    if (dateErr) return { error: dateErr }
  }
  if (formData.venue_id) {
    const venueErr = validateUUID(formData.venue_id, 'Sede')
    if (venueErr) return { error: venueErr }
  }

  const supabase = await createClient()
  const payload: { name?: string | null; date?: string; venue_id?: string | null; ticket_url?: string | null } = {}

  if (formData.name !== undefined) {
    payload.name = sanitizeText(formData.name, MAX_NAME_LENGTH)
  }
  if (formData.date !== undefined) {
    payload.date = formData.date
  }
  if (formData.venue_id !== undefined) {
    payload.venue_id = formData.venue_id || null
  }
  if (formData.ticket_url !== undefined) {
    payload.ticket_url = formData.ticket_url.trim() || null
  }

  if (Object.keys(payload).length > 0) {
    const { error } = await supabase.from('events').update(payload).eq('id', id)
    if (error) {
      console.error('Error actualizando evento:', error)
      return { error: sanitizeError(error) }
    }
  }

  if (formData.artist_ids !== undefined) {
    const { error: delErr } = await supabase.from('lineups').delete().eq('event_id', id)
    if (delErr) {
      console.error('Error eliminando lineups:', delErr)
      return { error: sanitizeError(delErr) }
    }
    if (formData.artist_ids.length > 0) {
      const invalidId = formData.artist_ids.find((aid) => validateUUID(aid) !== null)
      if (invalidId) return { error: 'ID de artista inválido.' }

      const { error: insErr } = await supabase.from('lineups').insert(
        formData.artist_ids.map((artist_id) => ({ event_id: id, artist_id }))
      )
      if (insErr) {
        console.error('Error insertando lineups:', insErr)
        return { error: sanitizeError(insErr) }
      }
    }
  }

  return {}
}

/** Borra el evento (y su lineup) sin redirigir — misma razón que insertEvent. */
export async function removeEvent(id: string): Promise<ActionResult> {
  const userId = await getCurrentUserId()
  if (!userId) return { error: 'Usuario no autenticado' }

  const idErr = validateUUID(id, 'Evento')
  if (idErr) return { error: idErr }

  const supabase = await createClient()
  const { error: lineupsError } = await supabase.from('lineups').delete().eq('event_id', id)
  if (lineupsError) {
    console.error('Error eliminando lineups:', lineupsError)
    return { error: sanitizeError(lineupsError) }
  }

  const { error: eventError } = await supabase.from('events').delete().eq('id', id)
  if (eventError) {
    console.error('Error eliminando evento:', eventError)
    return { error: sanitizeError(eventError) }
  }

  return {}
}
