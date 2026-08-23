import { createClient } from '@/src/core/lib/supabase/server'
import type { Venue } from '@/src/core/types'

export interface VenueWithEvents extends Venue {
  events: Array<{
    id: string
    name: string | null
    date: string
    lineups: Array<{ artists: { name: string } }>
    attendance: Array<{ status: string }>
  }>
}

export type VenueEvent = VenueWithEvents['events'][number]

export async function getVenues(): Promise<Venue[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('venues')
    .select('id, name, city, country, address, lat, lng')
    .order('name', { ascending: true })
  if (error) {
    console.error('Error cargando venues:', error)
    return []
  }
  return (data ?? []) as Venue[]
}

export async function getVenueById(id: string): Promise<VenueWithEvents | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('venues')
    .select(`
      id, name, city, country, address, lat, lng,
      events (
        id, name, date,
        lineups ( artists ( name ) ),
        attendance!left ( status )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) return null

  // Ordenar eventos por fecha descendente
  const venue = data as unknown as VenueWithEvents
  venue.events = (venue.events ?? []).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  return venue
}

/**
 * Historial de shows de una sede, sin traer la sede en sí — para resolver
 * `Venue.events` en GraphQL cuando la fila llegó por `getVenues()`, que no
 * incluye la relación. Sin esto el campo devolvería siempre `[]` en la query
 * de listado, que es peor que no exponerlo.
 */
export async function getVenueEvents(venueId: string): Promise<VenueEvent[]> {
  const venue = await getVenueById(venueId)
  return venue?.events ?? []
}
