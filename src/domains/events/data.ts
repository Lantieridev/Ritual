import { createClient } from '@/src/core/lib/supabase-server'
import type { EventWithRelations } from '@/src/core/types'
import { getCurrentUserId } from '@/src/domains/auth/data'

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
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select(EVENTS_SELECT)
    .order('date', { ascending: false })

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
  const supabase = await createClient()
  const currentUserId = await getCurrentUserId()

  const { data, error } = await supabase
    .from('events')
    .select(EVENTS_WITH_ATTENDANCE_SELECT)
    .order('date', { ascending: false })

  if (error) {
    console.error('Error cargando eventos con attendance:', error)
    return []
  }

  // Filtrar attendance al usuario actual
  const events = (data ?? []) as EventWithAttendance[]
  return events.map((ev) => ({
    ...ev,
    attendance: (ev.attendance ?? []).filter((a) => a.user_id === currentUserId),
  }))
}

export async function getEventById(
  id: string
): Promise<EventWithRelations | null> {
  const supabase = await createClient()
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

