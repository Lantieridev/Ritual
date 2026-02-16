/**
 * Tipos de dominio para RITUAL.
 * Alineados con el esquema en db.sql: events (central), lineups (events-artists), attendance (usuario-evento).
 */

/** Artista. Participa en eventos a través de la tabla lineups (muchos a muchos). */
export interface Artist {
  id: string
  name: string
  genre?: string | null
  image_url?: string | null
  spotify_id?: string | null
}

/** Sede del recital (venues). events.venue_id apunta aquí. */
export interface Venue {
  id: string
  name: string
  address?: string | null
  city?: string | null
  country?: string | null
  lat?: number | null
  lng?: number | null
}

/**
 * Fila de lineup: relación evento-artista con datos de la tabla lineups.
 * En las respuestas de Supabase viene anidada como lineups({ artists(...) }).
 */
export interface LineupRow {
  artists: Pick<Artist, 'id' | 'name' | 'genre'>
  /** Escenario (ej: "Escenario Norte"). Opcional en el select. */
  stage?: string | null
  start_time?: string | null
  is_headliner?: boolean
}

/**
 * Evento base (tabla central events).
 * Puede ser suelto, parte de una gira (tour_id) o de una edición de festival (festival_edition_id).
 */
export interface Event {
  id: string
  name: string | null
  date: string
  venue_id: string | null
  tour_id?: string | null
  festival_edition_id?: string | null
  is_child_event?: boolean
  /** scheduled | cancelled | sold_out */
  status?: string
  created_at?: string
}

/**
 * Evento con relaciones expandidas (venue + lineups con artists).
 * Es el formato que devuelve Supabase con el select que usamos en listado y detalle.
 */
export interface EventWithRelations extends Event {
  venues: Pick<Venue, 'name' | 'city'> | null
  lineups: LineupRow[] | null
}

/** Payload mínimo para crear un evento manualmente (formulario "nuevo recital"). */
export interface EventCreateInput {
  name: string
  date: string
  venue_id: string
}
