'use server'

import { redirect } from 'next/navigation'
import { supabase } from '@/src/core/lib/supabase'
import { routes } from '@/src/core/lib/routes'
import type { EventCreateInput, EventUpdateInput } from '@/src/core/types'
import type { BandsintownEvent } from '@/src/core/lib/bandsintown'

function validateCreate(data: EventCreateInput): string | null {
  if (!data.name?.trim()) return 'El nombre del recital es obligatorio.'
  if (!data.date) return 'La fecha es obligatoria.'
  if (!data.venue_id) return 'Debes elegir una sede.'
  return null
}

export async function createEvent(formData: EventCreateInput): Promise<{ error?: string }> {
  const err = validateCreate(formData)
  if (err) return { error: err }

  const { data: newEvent, error } = await supabase
    .from('events')
    .insert({
      name: formData.name.trim(),
      date: formData.date,
      venue_id: formData.venue_id,
    })
    .select('id')
    .single()

  if (error || !newEvent) {
    console.error('Error creando evento:', error)
    return { error: error?.message ?? 'Error creando evento.' }
  }

  if (formData.artist_ids?.length) {
    const { error: lineupsError } = await supabase.from('lineups').insert(
      formData.artist_ids.map((artist_id) => ({ event_id: newEvent.id, artist_id }))
    )
    if (lineupsError) console.error('Error creando lineups:', lineupsError)
  }

  redirect(routes.home)
}

/**
 * Crea en nuestra base un recital a partir de un evento de Bandsintown.
 * Busca o crea sede y artista para no duplicar. La base solo guarda lo que el usuario agrega.
 */
export async function addEventFromBandsintown(
  bitEvent: BandsintownEvent,
  artistNameForLineup?: string
): Promise<{ error?: string }> {
  const venueName = bitEvent.venue?.name?.trim()
  if (!venueName) return { error: 'El evento no tiene sede.' }

  const dateStr = bitEvent.datetime
  if (!dateStr) return { error: 'El evento no tiene fecha.' }

  const artistName =
    artistNameForLineup?.trim() ||
    bitEvent.lineup?.[0]?.trim() ||
    bitEvent.title?.trim() ||
    'Artista'
  const eventName = bitEvent.title?.trim() || `${artistName} @ ${venueName}`

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
        city: bitEvent.venue.city?.trim() || null,
        country: bitEvent.venue.country?.trim() || null,
      })
      .select('id')
      .single()
    if (venueErr || !newVenue) {
      console.error('Error creando sede:', venueErr)
      return { error: venueErr?.message ?? 'Error creando sede.' }
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
      return { error: artistErr?.message ?? 'Error creando artista.' }
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
    return { error: eventErr?.message ?? 'Error creando evento.' }
  }

  await supabase.from('lineups').insert({ event_id: newEvent.id, artist_id: artistId })
  redirect(routes.events.detail(newEvent.id))
}

export async function updateEvent(
  id: string,
  formData: EventUpdateInput
): Promise<{ error?: string }> {
  if (!id) return { error: 'ID de evento inválido.' }

  const payload: { name?: string | null; date?: string; venue_id?: string | null } = {}
  if (formData.name !== undefined) payload.name = formData.name.trim() || null
  if (formData.date !== undefined) payload.date = formData.date
  if (formData.venue_id !== undefined) payload.venue_id = formData.venue_id || null

  if (Object.keys(payload).length > 0) {
    const { error } = await supabase.from('events').update(payload).eq('id', id)
    if (error) {
      console.error('Error actualizando evento:', error)
      return { error: error.message }
    }
  }

  if (formData.artist_ids !== undefined) {
    const { error: delErr } = await supabase.from('lineups').delete().eq('event_id', id)
    if (delErr) {
      console.error('Error eliminando lineups:', delErr)
      return { error: delErr.message }
    }
    if (formData.artist_ids.length > 0) {
      const { error: insErr } = await supabase.from('lineups').insert(
        formData.artist_ids.map((artist_id) => ({ event_id: id, artist_id }))
      )
      if (insErr) {
        console.error('Error insertando lineups:', insErr)
        return { error: insErr.message }
      }
    }
  }

  redirect(routes.events.detail(id))
}

export async function deleteEvent(id: string): Promise<{ error?: string }> {
  if (!id) return { error: 'ID de evento inválido.' }

  const { error: lineupsError } = await supabase.from('lineups').delete().eq('event_id', id)
  if (lineupsError) {
    console.error('Error eliminando lineups:', lineupsError)
    return { error: lineupsError.message }
  }

  const { error: eventError } = await supabase.from('events').delete().eq('id', id)
  if (eventError) {
    console.error('Error eliminando evento:', eventError)
    return { error: eventError.message }
  }

  redirect(routes.home)
}
