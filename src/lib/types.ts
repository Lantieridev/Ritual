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

/** Payload mínimo para crear un artista (formulario). */
export interface ArtistCreateInput {
  name: string
  genre?: string
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

/** Payload mínimo para crear una sede (formulario). */
export interface VenueCreateInput {
  name: string
  city?: string
  address?: string
  country?: string
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

/** Payload para crear un evento (nombre, fecha, sede, opcionalmente artistas del lineup). */
export interface EventCreateInput {
  name: string
  date: string
  venue_id: string
  /** IDs de artistas para el lineup; se insertan en tabla lineups tras crear el evento. */
  artist_ids?: string[]
}

/** Payload para actualizar un evento; artist_ids reemplaza todo el lineup. */
export interface EventUpdateInput {
  name?: string
  date?: string
  venue_id?: string
  /** Si se envía, reemplaza el lineup del evento (borra anteriores e inserta estos). */
  artist_ids?: string[]
}
