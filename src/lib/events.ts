import { supabase } from '@/src/lib/supabase'
import type { EventWithRelations, EventCreateInput, Venue } from '@/src/lib/types'

/** Select usado en listado y detalle: evento con venue y lineups (artistas). */
const EVENTS_SELECT = `
  *,
  venues ( name, city ),
  lineups (
    artists ( id, name, genre )
  )
`

/**
 * Obtiene todos los eventos con venue y artistas del lineup.
 * Pensado para Server Components (llamada directa a Supabase).
 */
export async function getEvents(): Promise<EventWithRelations[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENTS_SELECT)
    .order('date', { ascending: true })

  if (error) {
    console.error('Error cargando eventos:', error)
    return []
  }
  return (data ?? []) as EventWithRelations[]
}

/**
 * Obtiene un evento por id con sus relaciones.
 * Devuelve null si no existe o hay error.
 */
export async function getEventById(
  id: string
): Promise<EventWithRelations | null> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENTS_SELECT)
    .eq('id', id)
    .single()

  if (error || !data) {
    if (error) console.error('Error cargando evento:', error)
    return null
  }
  return data as EventWithRelations
}

/**
 * Lista todas las sedes para selects (p. ej. formulario de nuevo recital).
 */
export async function getVenues(): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('venues')
    .select('id, name, city')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error cargando sedes:', error)
    return []
  }
  return (data ?? []) as Venue[]
}
