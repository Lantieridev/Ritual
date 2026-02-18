import { supabase } from '@/src/core/lib/supabase'
import type { EventWithRelations } from '@/src/core/types'

const EVENTS_SELECT = `
  *,
  venues ( name, city ),
  lineups (
    artists ( id, name, genre )
  )
`

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
