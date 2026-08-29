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

export type VenueTipCategory = 'estacionamiento' | 'cola' | 'que_llevar' | 'otro'

export interface VenueTip {
  id: string
  venue_id: string
  category: VenueTipCategory
  body: string
  created_at: string
}

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
 * Historial de shows de sedes, para el DataLoader de `Venue.events`. Pedir
 * `events` sobre `getVenues()` (que no incluye la relación) disparaba un
 * `getVenueById` — detalle anidado completo — por sede en la query de
 * listado, de ahí el batching.
 *
 * Consulta `events` directo por `venue_id` en vez de `venues` con el embed,
 * porque acá el punto de entrada es el lote de sedes y lo que se necesita son
 * sus eventos agrupados.
 */
export async function getVenueEventsBatch(
  venueIds: readonly string[]
): Promise<VenueEvent[][]> {
  if (venueIds.length === 0) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select(`
      id, name, date, venue_id,
      lineups ( artists ( name ) ),
      attendance!left ( status )
    `)
    .in('venue_id', venueIds as string[])
    .order('date', { ascending: false })

  if (error) {
    console.error('Error cargando shows por sede:', error)
    return venueIds.map(() => [])
  }

  const rows = (data ?? []) as unknown as Array<VenueEvent & { venue_id: string }>

  const byVenue = new Map<string, VenueEvent[]>()
  for (const row of rows) {
    const list = byVenue.get(row.venue_id)
    if (list) list.push(row)
    else byVenue.set(row.venue_id, [row])
  }

  return venueIds.map((id) => byVenue.get(id) ?? [])
}

/** Tips de una sede, más nuevos primero — issue #60. */
export async function getVenueTips(venueId: string): Promise<VenueTip[]> {
  const [tips] = await getVenueTipsBatch([venueId])
  return tips
}

/**
 * Versión por lote, para el DataLoader de `Venue.tips` — misma razón que
 * `getVenueEventsBatch`: sin esto, pedir `tips` sobre una lista de sedes
 * dispararía una consulta por sede.
 */
export async function getVenueTipsBatch(venueIds: readonly string[]): Promise<VenueTip[][]> {
  if (venueIds.length === 0) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('venue_tips')
    .select('id, venue_id, category, body, created_at')
    .in('venue_id', venueIds as string[])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error cargando tips de sedes:', error)
    return venueIds.map(() => [])
  }

  const rows = (data ?? []) as VenueTip[]
  const byVenue = new Map<string, VenueTip[]>()
  for (const row of rows) {
    const list = byVenue.get(row.venue_id)
    if (list) list.push(row)
    else byVenue.set(row.venue_id, [row])
  }
  return venueIds.map((id) => byVenue.get(id) ?? [])
}
