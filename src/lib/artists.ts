import { supabase } from '@/src/lib/supabase'
import type { Artist } from '@/src/lib/types'

/**
 * Lista todos los artistas, ordenados por nombre.
 * Usado en: selector de lineup (eventos), listado de artistas.
 * Escalable: más adelante se puede añadir paginación o filtro por género.
 */
export async function getArtists(): Promise<Artist[]> {
  const { data, error } = await supabase
    .from('artists')
    .select('id, name, genre')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error cargando artistas:', error)
    return []
  }
  return (data ?? []) as Artist[]
}
