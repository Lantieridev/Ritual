import { createClient } from '@/src/core/lib/supabase/server'
import type { Artist } from '@/src/core/types'

export interface ArtistWithEvents extends Artist {
  events: Array<{
    id: string
    name: string | null
    date: string
    venues: { name: string; city: string | null } | null
    event_photos: Array<{ storage_path: string; caption: string | null }>
    attendance: Array<{ status: string; rating: number | null; review: string | null }>
  }>
}

export type ArtistEvent = ArtistWithEvents['events'][number]

export async function getArtists(): Promise<Artist[]> {
  const supabase = await createClient()
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
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('artists')
    .select(`
      id, name, genre, image_url, spotify_id,
      lineups (
        events (
          id, name, date,
          venues ( name, city ),
          event_photos ( storage_path, caption ),
          attendance!left ( status, rating, review )
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) return null

  type RawEvent = ArtistWithEvents['events'][number]
  type RawArtist = Artist & { lineups: Array<{ events: RawEvent | null }> }

  const artist = data as unknown as RawArtist

  // Aplanar eventos del lineup
  const events = (artist.lineups ?? [])
    .map((l) => l.events)
    .filter((e): e is RawEvent => e !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return {
    id: artist.id,
    name: artist.name,
    genre: artist.genre,
    image_url: artist.image_url,
    spotify_id: artist.spotify_id,
    events,
  } as ArtistWithEvents
}

/**
 * Historial de shows de un artista, sin traer el artista en sí — para
 * resolver `Artist.events` en GraphQL cuando la fila llegó por
 * `getArtists()`, que no incluye la relación. Sin esto el campo devolvería
 * siempre `[]` en la query de listado, que es peor que no exponerlo.
 */
export async function getArtistEvents(artistId: string): Promise<ArtistEvent[]> {
  const artist = await getArtistById(artistId)
  return artist?.events ?? []
}

/**
 * Versión por lote de `getArtistEvents`, para el DataLoader de
 * `Artist.events`. La versión de a uno llama a `getArtistById`, que es un
 * select anidado de cuatro niveles: pedir `events` sobre la query de listado
 * disparaba una de esas por artista del catálogo.
 *
 * Devuelve un array alineado con `artistIds`, que es el contrato que espera
 * DataLoader: misma longitud y mismo orden que las claves.
 */
export async function getArtistEventsBatch(
  artistIds: readonly string[]
): Promise<ArtistEvent[][]> {
  if (artistIds.length === 0) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lineups')
    .select(`
      artist_id,
      events (
        id, name, date,
        venues ( name, city ),
        event_photos ( storage_path, caption ),
        attendance!left ( status, rating, review )
      )
    `)
    .in('artist_id', artistIds as string[])

  if (error) {
    console.error('Error cargando shows por artista:', error)
    return artistIds.map(() => [])
  }

  const rows = (data ?? []) as unknown as Array<{ artist_id: string; events: ArtistEvent | null }>

  const byArtist = new Map<string, ArtistEvent[]>()
  for (const row of rows) {
    if (!row.events) continue
    const list = byArtist.get(row.artist_id)
    if (list) list.push(row.events)
    else byArtist.set(row.artist_id, [row.events])
  }

  return artistIds.map((id) =>
    (byArtist.get(id) ?? []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  )
}
