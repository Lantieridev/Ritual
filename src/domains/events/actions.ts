'use server'

import { redirect } from 'next/navigation'
import { supabase } from '@/src/core/lib/supabase'
import { routes } from '@/src/core/lib/routes'
import { validateUUID, sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import type { EventCreateInput, EventUpdateInput, FutureEvent } from '@/src/core/types'

const MAX_NAME_LENGTH = 200
const MAX_VENUE_NAME_LENGTH = 200
const MAX_ARTIST_NAME_LENGTH = 200

function validateCreate(data: EventCreateInput): string | null {
  const name = sanitizeText(data.name, MAX_NAME_LENGTH)
  if (!name) return 'El nombre del recital es obligatorio.'
  if (!data.date) return 'La fecha es obligatoria.'
  if (!data.venue_id) return 'Debes elegir una sede.'
  if (data.venue_id && validateUUID(data.venue_id, 'Sede')) return validateUUID(data.venue_id, 'Sede')
  return null
}

export async function createEvent(formData: EventCreateInput): Promise<{ error?: string }> {
  const err = validateCreate(formData)
  if (err) return { error: err }

  const name = sanitizeText(formData.name, MAX_NAME_LENGTH)!

  const { data: newEvent, error } = await supabase
    .from('events')
    .insert({
      name,
      date: formData.date,
      venue_id: formData.venue_id,
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
    if (lineupsError) console.error('Error creando lineups:', lineupsError)
  }

  redirect(routes.home)
}

/**
 * Crea en nuestra base un recital a partir de un evento externo (Ticketmaster, Setlist.fm, Last.fm, etc.).
 * Busca o crea sede y artista para no duplicar.
 */
export async function addExternalEvent(
  event: FutureEvent,
  artistNameForLineup?: string
): Promise<{ error?: string; eventId?: string }> {
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

  let venueId: string | null = null
  const { data: existingVenues } = await supabase
    .from('venues')
    .select('id')
    .ilike('name', venueName)
    .limit(1)
  if (existingVenues?.[0]) {
    venueId = existingVenues[0].id
  } else {
    const { data: newVenue, error: venueErr } = await supabase
      .from('venues')
      .insert({
        name: venueName,
        city: sanitizeText(event.venue.city, 100),
        country: sanitizeText(event.venue.country, 100),
      })
      .select('id')
      .single()
    if (venueErr || !newVenue) {
      console.error('Error creando sede:', venueErr)
      return { error: sanitizeError(venueErr) }
    }
    venueId = newVenue.id
  }

  let artistId: string | null = null
  const { data: existingArtists } = await supabase
    .from('artists')
    .select('id')
    .ilike('name', artistName)
    .limit(1)
  if (existingArtists?.[0]) {
    artistId = existingArtists[0].id
  } else {
    const { data: newArtist, error: artistErr } = await supabase
      .from('artists')
      .insert({ name: artistName })
      .select('id')
      .single()
    if (artistErr || !newArtist) {
      console.error('Error creando artista:', artistErr)
      return { error: sanitizeError(artistErr) }
    }
    artistId = newArtist.id
  }

  const { data: newEvent, error: eventErr } = await supabase
    .from('events')
    .insert({
      name: eventName,
      date: dateStr,
      venue_id: venueId,
    })
    .select('id')
    .single()

  if (eventErr || !newEvent) {
    console.error('Error creando evento:', eventErr)
    return { error: sanitizeError(eventErr) }
  }

  await supabase.from('lineups').insert({ event_id: newEvent.id, artist_id: artistId })
  // Return the new event ID — the client component handles navigation.
  // DO NOT call redirect() here: it throws NEXT_REDIRECT which useTransition
  // silently swallows, making the button appear to do nothing.
  return { eventId: newEvent.id }
}

export async function updateEvent(
  id: string,
  formData: EventUpdateInput
): Promise<{ error?: string }> {
  const idErr = validateUUID(id, 'Evento')
  if (idErr) return { error: idErr }

  const payload: { name?: string | null; date?: string; venue_id?: string | null } = {}

  if (formData.name !== undefined) {
    payload.name = sanitizeText(formData.name, MAX_NAME_LENGTH)
  }
  if (formData.date !== undefined) payload.date = formData.date
  if (formData.venue_id !== undefined) {
    if (formData.venue_id) {
      const venueErr = validateUUID(formData.venue_id, 'Sede')
      if (venueErr) return { error: venueErr }
    }
    payload.venue_id = formData.venue_id || null
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

  redirect(routes.events.detail(id))
}

export async function deleteEvent(id: string): Promise<{ error?: string }> {
  const idErr = validateUUID(id, 'Evento')
  if (idErr) return { error: idErr }

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

  redirect(routes.home)
}
