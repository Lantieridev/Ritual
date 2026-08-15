import { createClient } from '@/src/core/lib/supabase/server'

/** One row of the canonical genre vocabulary (see `genres` in `20260912010000_genre_vocabulary.sql`). */
export interface GenreOption {
  key: string
  label: string
}

/** Public catalog read — no user session required, `genres` grants select to anon and authenticated. */
export async function listGenres(): Promise<GenreOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('genres')
    .select('key, label_es, sort')
    .order('sort', { ascending: true })

  if (error) {
    console.error('Error cargando géneros:', error)
    return []
  }

  return (data ?? []).map((row) => ({ key: row.key, label: row.label_es }))
}
