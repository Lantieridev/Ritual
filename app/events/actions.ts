'use server'

import { redirect } from 'next/navigation'
import { supabase } from '@/src/lib/supabase'
import type { EventCreateInput, EventUpdateInput } from '@/src/lib/types'

/** Valida y normaliza payload de creación. Devuelve error o null. */
function validateCreate(data: EventCreateInput): string | null {
  if (!data.name?.trim()) return 'El nombre del recital es obligatorio.'
  if (!data.date) return 'La fecha es obligatoria.'
  if (!data.venue_id) return 'Debes elegir una sede.'
  return null
}

/**
 * Crea un nuevo evento en la base de datos.
 * Server Action: se ejecuta en el servidor; el cliente solo invoca.
 * Tras insertar, redirige al listado para dar feedback visual.
 */
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

  redirect('/')
}

/**
 * Actualiza un evento existente.
 * Solo se envían campos presentes; validación mínima en servidor.
 */
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

  redirect(`/events/${id}`)
}

/**
 * Elimina un evento. Primero borra lineups (FK) para evitar violación de integridad.
 * Requiere políticas RLS de DELETE en events y lineups.
 */
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

  redirect('/')
}
