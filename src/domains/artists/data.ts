import { supabase } from '@/src/core/lib/supabase'
import type { Artist } from '@/src/core/types'

export interface ArtistWithEvents extends Artist {
  events: Array<{
    id: string
    name: string | null
    date: string
    venues: { name: string; city: string | null } | null
    event_photos: Array<{ storage_path: string; caption: string | null }>
  }>
}

export async function getArtists(): Promise<Artist[]> {
  const { data, error } = await supabase
    .from('artists')
    .select('id, name, genre, image_url, spotify_id')
    .order('name', { ascending: true })
  if (error) {
    console.error('Error cargando artistas:', error)
    return []
  }
  return (data ?? []) as Artist[]
}

export async function getArtistById(id: string): Promise<ArtistWithEvents | null> {
  const { data, error } = await supabase
    .from('artists')
    .select(`
      id, name, genre, image_url, spotify_id,
      lineups (
        events (
          id, name, date,
          venues ( name, city ),
          event_photos ( storage_path, caption )
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) return null

  const artist = data as any

  // Aplanar eventos del lineup
  const events = (artist.lineups ?? [])
    .map((l: any) => l.events)
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return {
    id: artist.id,
    name: artist.name,
    genre: artist.genre,
    image_url: artist.image_url,
    spotify_id: artist.spotify_id,
    events,
  } as ArtistWithEvents
}
