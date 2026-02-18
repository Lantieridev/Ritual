import { supabase } from '@/src/core/lib/supabase'
import type { Venue } from '@/src/core/types'

export interface VenueWithEvents extends Venue {
  events: Array<{
    id: string
    name: string | null
    date: string
    lineups: Array<{ artists: { name: string } }>
  }>
}

export async function getVenues(): Promise<Venue[]> {
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
  const { data, error } = await supabase
    .from('venues')
    .select(`
      id, name, city, country, address, lat, lng,
      events (
        id, name, date,
        lineups ( artists ( name ) )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) return null

  // Ordenar eventos por fecha descendente
  const venue = data as any
  venue.events = (venue.events ?? []).sort(
    (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  return venue as VenueWithEvents
}
