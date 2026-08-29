import { createClient } from '@/src/core/lib/supabase/server'
import type { EventWithRelations } from '@/src/core/types'
import { getCurrentUserId } from '@/src/core/auth/session'

const EVENTS_SELECT = `
  *,
  venues ( name, city, country ),
  lineups (
    artists ( id, name, genre )
  )
`

// Solo la ficha de un evento necesita lat/lng (clima exacto del show, ver
// issue #8) — el listado del home no pide estos campos de más.
const EVENT_DETAIL_SELECT = `
  *,
  venues ( name, city, country, lat, lng ),
  lineups (
    artists ( id, name, genre )
  )
`

const EVENTS_WITH_ATTENDANCE_SELECT = `
  *,
  venues ( name, city, country ),
  lineups (
    artists ( id, name, genre )
  ),
  attendance!left (
    id,
    status,
    user_id,
    rating,
    review
  )
`

export interface EventWithAttendance extends EventWithRelations {
  attendance?: Array<{
    id: string
    status: string
    user_id: string
    rating: number | null
    review: string | null
  }>
}

// Cota defensiva: sin esto, la query crece sin límite con el catálogo
// compartido entero (no solo con los shows del usuario que la pide) —
// cualquier visitante, logueado o no, paga el costo de traer todo.
export const MAX_EVENTS = 1000

export async function getEvents(options?: { limit?: number; offset?: number }): Promise<EventWithRelations[]> {
  const limit = options?.limit ?? MAX_EVENTS
  const offset = options?.offset ?? 0

  const supabase = await createClient()
  let query = supabase
    .from('events')
    .select(EVENTS_SELECT)
    .order('date', { ascending: false })

  if (options?.limit !== undefined || options?.offset !== undefined) {
    query = query.range(offset, offset + limit - 1)
  } else {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error cargando eventos:', error)
    return []
  }
  return (data ?? []) as EventWithRelations[]
}

/**
 * Carga todos los eventos con su attendance del usuario actual.
 * Permite filtrar y mostrar badges de estado en el home.
 */
export async function getEventsWithAttendance(options?: { limit?: number; offset?: number }): Promise<EventWithAttendance[]> {
  const limit = options?.limit ?? MAX_EVENTS
  const offset = options?.offset ?? 0

  const supabase = await createClient()
  let query = supabase
    .from('events')
    .select(EVENTS_WITH_ATTENDANCE_SELECT)
    .order('date', { ascending: false })

  if (options?.limit !== undefined || options?.offset !== undefined) {
    query = query.range(offset, offset + limit - 1)
  } else {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error cargando eventos con attendance:', error)
    return []
  }

  const userId = await getCurrentUserId()
  const events = (data ?? []) as EventWithAttendance[]

  // Si no hay usuario, retornamos eventos sin attendance
  if (!userId) {
    return events.map(ev => ({ ...ev, attendance: [] }))
  }

  // RLS ya filtra attendance por user_id, así que solo devolvemos lo que llega de la DB.
  return events.map((ev) => ({
    ...ev,
    attendance: ev.attendance ?? [],
  }))
}

export async function getEventById(
  id: string
): Promise<EventWithRelations | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_DETAIL_SELECT)
    .eq('id', id)
    .single()

  if (error || !data) {
    if (error) console.error('Error cargando evento:', error)
    return null
  }
  return data as EventWithRelations
}


/**
 * Sólo `id` y `date` de cada evento, para el sitemap. `getEvents()` trae
 * `*` más los embeds de venues y lineups→artists, y el sitemap descartaba
 * todo eso salvo el id — pagando el join completo en cada visita de un
 * crawler.
 */
export async function getEventIdsForSitemap(): Promise<Array<{ id: string; date: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, date')
    .order('date', { ascending: false })
    .limit(MAX_EVENTS)

  if (error) {
    console.error('Error cargando ids de eventos para el sitemap:', error)
    return []
  }
  return (data ?? []) as Array<{ id: string; date: string }>
}

/**
 * Sólo los eventos donde el usuario registró asistencia (de cualquier estado:
 * went, going o interested), con la suya adjunta.
 *
 * /wrapped llamaba a getEventsWithAttendance() —hasta MAX_EVENTS del catálogo
 * compartido, con venue, lineup y attendance— para después quedarse nada más
 * que con los 'went' del usuario del año elegido. Sumado a getPersonalStats()
 * en el mismo Promise.all, eran dos barridas casi idénticas del catálogo por
 * cada carga de la página.
 *
 * Igual que en stats, se parte de `attendance` filtrada por usuario y se
 * embebe el evento, así la base devuelve sólo el historial propio.
 */
export async function getMyEvents(): Promise<EventWithAttendance[]> {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      id, status, user_id, rating, review,
      events (
        *,
        venues ( name, city, country ),
        lineups ( artists ( id, name, genre ) )
      )
    `)
    .eq('user_id', userId)

  if (error) {
    console.error('Error cargando los shows del usuario:', error)
    return []
  }

  type Row = {
    id: string
    status: string
    user_id: string
    rating: number | null
    review: string | null
    events: Omit<EventWithAttendance, 'attendance'> | null
  }

  return (data as unknown as Row[])
    .filter((row): row is Row & { events: Omit<EventWithAttendance, 'attendance'> } => row.events !== null)
    .map((row) => ({
      ...row.events,
      attendance: [
        { id: row.id, status: row.status, user_id: row.user_id, rating: row.rating, review: row.review },
      ],
    })) as EventWithAttendance[]
}

const NEARBY_LIMIT = 6

/**
 * Shows futuros del catálogo compartido cuya sede está en `city` — issue #55.
 * Distinto de "Cerca tuyo" (wishlist vía Ticketmaster, sin nada geográfico
 * real pese al nombre): esto es geografía real contra `venues.city`, sin
 * mirar wishlist ni attendance.
 *
 * Dos consultas en vez de un filtro anidado (`.eq('venues.city', city)`
 * sobre un join): más predecible que depender de que Supabase-js resuelva
 * bien un filtro sobre una tabla embebida, y esta ruta no es hot-path.
 *
 * Match exacto (case-insensitive), no normalizado — el propio issue #55 lo
 * deja anotado como decisión de diseño aparte, no bloqueante para una
 * primera versión: "CABA" en el perfil no matchea "Buenos Aires" en venues.
 */
export async function getUpcomingEventsInCity(city: string, now: Date = new Date()): Promise<EventWithRelations[]> {
  const trimmed = city.trim()
  if (!trimmed) return []

  const supabase = await createClient()

  const { data: venueRows, error: venueError } = await supabase
    .from('venues')
    .select('id')
    .ilike('city', trimmed)

  if (venueError) {
    console.error('Error buscando sedes por ciudad:', venueError)
    return []
  }
  const venueIds = (venueRows ?? []).map((v) => v.id as string)
  if (venueIds.length === 0) return []

  const { data, error } = await supabase
    .from('events')
    .select(EVENTS_SELECT)
    .in('venue_id', venueIds)
    .gte('date', now.toISOString())
    .order('date', { ascending: true })
    .limit(NEARBY_LIMIT)

  if (error) {
    console.error('Error buscando shows por ciudad:', error)
    return []
  }
  return (data ?? []) as unknown as EventWithRelations[]
}
