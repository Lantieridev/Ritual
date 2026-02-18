import { supabase } from '@/src/core/lib/supabase'
import type { Venue } from '@/src/core/types'

export async function getVenues(): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('venues')
    .select('id, name, city, address, country')
    .order('name', { ascending: true })
  if (error) {
    console.error('Error cargando sedes:', error)
    return []
  }
  return (data ?? []) as Venue[]
}
