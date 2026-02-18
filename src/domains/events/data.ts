import { supabase } from '@/src/core/lib/supabase'
import type { EventWithRelations } from '@/src/core/types'

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

const EVENTS_SELECT = `
  *,
  venues ( name, city, country ),
  lineups (
    artists ( id, name, genre )
  )
`

const EVENTS_WITH_ATTENDANCE_SELECT = `
  *,
  venues ( name, city, country ),
  lineups (
    artists ( id, name, genre )
  ),
  attendance!left (
    id,
    status,
    user_id,
    memories ( rating, review )
  )
`

export interface EventWithAttendance extends EventWithRelations {
  attendance?: Array<{
    id: string
    status: string
    user_id: string
    memories?: Array<{ rating: number | null; review: string | null }>
  }>
}

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
 * Carga todos los eventos con su attendance del usuario actual.
 * Permite filtrar y mostrar badges de estado en el home.
 */
export async function getEventsWithAttendance(): Promise<EventWithAttendance[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENTS_WITH_ATTENDANCE_SELECT)
    .order('date', { ascending: true })

  if (error) {
    console.error('Error cargando eventos con attendance:', error)
    return []
  }

  // Filtrar attendance al DEV_USER_ID
  const events = (data ?? []) as EventWithAttendance[]
  return events.map((ev) => ({
    ...ev,
    attendance: (ev.attendance ?? []).filter((a) => a.user_id === DEV_USER_ID),
  }))
}

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

