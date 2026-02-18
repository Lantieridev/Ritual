import { supabase } from '@/src/core/lib/supabase'
import type { Artist } from '@/src/core/types'

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
