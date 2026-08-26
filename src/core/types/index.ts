/**
 * Tipos de dominio para RITUAL.
 * Alineados con el esquema en Supabase: events, lineups, attendance, expenses (personales).
 */

/**
 * Forma de retorno estándar para Server Actions: `error` opcional en fallo,
 * más los campos de éxito que necesite cada action (ej. `ActionResult<{ eventId: string }>`).
 * Reemplaza los ~6 tipos de retorno distintos que había hand-rolled en cada actions.ts.
 */
export type ActionResult<TData extends object = object> = { error?: string } & TData

/** Artista. Participa en eventos a través de la tabla lineups (muchos a muchos). */
export interface Artist {
  id: string
  name: string
  genre?: string | null
  image_url?: string | null
  spotify_id?: string | null
  status?: string
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
  status?: string
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
  stage?: string | null
  start_time?: string | null
  is_headliner?: boolean
}

/**
 * Evento base (tabla central events). Puede ser suelto o parte de un
 * festival — ver `festivals` + `festival_events` (tabla puente).
 */
export interface Event {
  id: string
  name: string | null
  date: string
  venue_id: string | null
  status?: string
  created_at?: string
  /**
   * Link manual a un proveedor de ticketing (AllAccess, Passline, etc.).
   * No auto-generado: ninguno de los dos expone una API o un patrón de URL
   * de búsqueda documentado (a diferencia de Ticketmaster), así que lo
   * completa quien carga el evento — ver issue #19.
   */
  ticket_url?: string | null
}

/**
 * Evento con relaciones expandidas (venue + lineups con artists).
 */
export interface EventWithRelations extends Event {
  // lat/lng incluidos para el clima exacto del show (issue #8) — sin esto
  // la página del evento no puede pedirle a Open-Meteo el punto correcto.
  venues: Pick<Venue, 'name' | 'city' | 'country' | 'lat' | 'lng'> | null
  lineups: LineupRow[] | null
}


/** Payload para crear un evento (nombre, fecha, sede, opcionalmente artistas del lineup). */
export interface EventCreateInput {
  name: string
  date: string
  venue_id: string
  artist_ids?: string[]
  ticket_url?: string
}

/** Payload para actualizar un evento; artist_ids reemplaza todo el lineup. */
export interface EventUpdateInput {
  name?: string
  date?: string
  venue_id?: string
  artist_ids?: string[]
  ticket_url?: string
}

/** Gasto personal (no compartido con otros usuarios). Tabla expenses. */
export interface Expense {
  id: string
  user_id: string
  amount: number
  category: string
  note?: string | null
  event_id?: string | null
  date: string
  created_at?: string
}

/** Payload para crear un gasto (formulario). */
export interface ExpenseCreateInput {
  amount: number
  category: string
  note?: string
  event_id?: string
  date: string
}

/** Payload para actualizar un gasto (edición). */
export interface ExpenseUpdateInput {
  amount?: number
  category?: string
  note?: string
  event_id?: string
  date?: string
}

/** Respuesta GraphQL para un gasto. */
export interface GraphQLExpense {
  id: string
  userId: string
  amount: number
  category: string
  note?: string | null
  eventId?: string | null
  date: string
  createdAt?: string | null
}

/** Respuesta GraphQL para el resumen de gastos. */
export interface GraphQLExpenseSummary {
  total: number
  count: number
  byCategory: Record<string, number>
  byYear: Record<string, number>
}

/** Respuesta GraphQL para una sede. */
export interface GraphQLVenue {
  id: string
  name: string
  address?: string | null
  city?: string | null
  country?: string | null
  lat?: number | null
  lng?: number | null
}

/** Show del historial de una sede, tal como lo devuelve `Venue.events`. */
export interface GraphQLVenueEvent {
  id: string
  name: string | null
  date: string
  lineups: Array<{ artist: { name: string } }>
  attendance: Array<{ status: string }>
}

/** Respuesta GraphQL para el detalle de una sede, con su historial de shows. */
export interface GraphQLVenueWithEvents extends GraphQLVenue {
  events: GraphQLVenueEvent[]
}

/** Respuesta GraphQL para un artista. */
export interface GraphQLArtist {
  id: string
  name: string
  genre?: string | null
  imageUrl?: string | null
  spotifyId?: string | null
}

/** Show del historial de un artista, tal como lo devuelve `Artist.events`. */
export interface GraphQLArtistEvent {
  id: string
  name: string | null
  date: string
  venue: { name: string; city: string | null } | null
  photos: Array<{ storagePath: string; caption: string | null }>
  attendance: Array<{ status: string; rating: number | null; review: string | null }>
}

/** Respuesta GraphQL para el detalle de un artista, con su historial de shows. */
export interface GraphQLArtistWithEvents extends GraphQLArtist {
  events: GraphQLArtistEvent[]
}

/** Respuesta GraphQL para un festival, con sus días y tu asistencia. */
export interface GraphQLFestival {
  id: string
  name: string
  edition: string | null
  startDate: string
  endDate: string | null
  venueId: string | null
  city: string | null
  country: string | null
  website: string | null
  posterUrl: string | null
  notes: string | null
  createdAt: string
  venue: { name: string; city: string | null } | null
  festivalEvents: Array<{
    id: string
    dayLabel: string | null
    event: {
      id: string
      name: string | null
      date: string
      lineups: Array<{
        artist: { id: string; name: string }
        stage: string | null
        startTime: string | null
      }>
    }
  }>
  festivalAttendance: Array<{ status: string; rating: number | null; review: string | null }>
}

/**
 * Formato normalizado para eventos provenientes de APIs externas
 * (Ticketmaster, Setlist.fm, etc.). Usado por addExternalEvent en actions.ts.
 */
/**
 * Formato normalizado para eventos provenientes de APIs externas
 * (Ticketmaster, Setlist.fm, Last.fm, etc.).
 * Reemplaza a TicketmasterEvent y ExternalEvent previos.
 */
export interface FutureEvent {
  id: string
  title: string
  datetime: string
  venue: {
    name: string
    city?: string | null
    country?: string | null
  }
  lineup: string[]
  url?: string
  image?: string
  priceRange?: { min: number; max: number; currency: string }
  genre?: string
  status?: string
}

export type UserRole = 'usuario' | 'moderador' | 'admin'

/**
 * Perfil público del usuario.
 */
export interface Profile {
  id: string
  role?: UserRole | null
  username?: string | null
  full_name?: string | null
  avatar_url?: string | null
  website?: string | null
  bio?: string | null
  location?: string | null
  updated_at?: string | null
}
