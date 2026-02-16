import { supabase } from '@/src/lib/supabase'
import type { Venue } from '@/src/lib/types'

/**
 * Lista todas las sedes, ordenadas por nombre.
 * Usado en: formularios de evento (select), listado de sedes.
 * Escalable: más adelante se puede añadir búsqueda o filtro por ciudad.
 */
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
