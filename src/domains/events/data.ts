import { createClient } from '@/src/core/lib/supabase/server'
import type { EventWithRelations } from '@/src/core/types'
import { getCurrentUserId } from '@/src/core/auth/session'
import { combineDateAndTime, todayDateOnly } from '@/src/core/lib/dates'
import { pickShowTonight, type ShowTonight, type ShowTonightRow } from './show-tonight'

const MS_PER_DAY = 24 * 60 * 60 * 1000

const EVENTS_SELECT = `
  *,
  venues ( name, city, country ),
  lineups (
    artists ( id, name, genre ),
    b2b_group
  )
`

// Solo la ficha de un evento necesita lat/lng (clima exacto del show, ver
// issue #8) — el listado del home no pide estos campos de más.
const EVENT_DETAIL_SELECT = `
  *,
  venues ( name, city, country, lat, lng ),
  lineups (
    artists ( id, name, genre ),
    b2b_group
  )
`

const EVENTS_WITH_ATTENDANCE_SELECT = `
  *,
  venues ( name, city, country ),
  lineups (
    artists ( id, name, genre ),
    b2b_group
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
 *
 * Issue #63: MAX_EVENTS (1000) es una cota defensiva pensada para páginas
 * normales -no tiene nada que ver acá. Un sitemap.xml admite hasta 50.000
 * URLs por archivo (límite real de Google/sitemaps.org); capar esta query
 * en 1000 hacía que shows viejos desaparecieran del sitemap en silencio ni
 * bien el catálogo creciera pasado ese punto, sin ningún error visible. Si
 * el catálogo alguna vez se acerca a 50.000 eventos, ahí sí hace falta
 * partir esto en múltiples sitemaps con `generateSitemaps()` de Next.js —
 * hoy está lejísimos de esa escala.
 */
const SITEMAP_MAX_URLS = 50_000

export async function getEventIdsForSitemap(): Promise<Array<{ id: string; date: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, date')
    .order('date', { ascending: false })
    .limit(SITEMAP_MAX_URLS)

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

/**
 * Próximos shows del catálogo entero, del más cercano en adelante. Es lo que
 * ve en Home un visitante sin sesión: no hay ciudad ni gustos para afinar
 * (con ciudad, ver getUpcomingEventsInCity arriba).
 *
 * Corta desde el comienzo de hoy en hora argentina, no desde este instante:
 * para la app un show de hoy sigue siendo próximo aunque ya haya empezado
 * (misma regla que isUpcomingEvent), y uno cargado sin hora queda a
 * medianoche y se perdería a media mañana.
 */
export async function getUpcomingEvents(limit: number = NEARBY_LIMIT, now: Date = new Date()): Promise<EventWithRelations[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('events')
    .select(EVENTS_SELECT)
    .gte('date', combineDateAndTime(todayDateOnly(now), '00:00'))
    .order('date', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Error buscando próximos shows:', error)
    return []
  }
  return (data ?? []) as unknown as EventWithRelations[]
}

/**
 * El show al que el usuario va esta noche (issue #82), para la banda de
 * "Tu entrada de hoy" del layout raíz. Consulta "attendance-first": acotada
 * a las propias filas 'going' del usuario (tabla chica) en vez de partir del
 * catálogo entero de eventos — un filtro de fecha en SQL sobre el embed
 * necesitaría `!inner`, que el repo evita (ver getUpcomingEventsInCity más
 * arriba); `pickShowTonight` filtra el día calendario en Argentina (R1-003).
 */
export async function getShowTonight(userId: string, now: Date = new Date()): Promise<ShowTonight | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      status,
      events (
        id, name, date,
        lineups ( artists ( name ) )
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'going')

  if (error) {
    console.error('Error buscando el show de esta noche:', error)
    return null
  }

  return pickShowTonight((data ?? []) as unknown as ShowTonightRow[], now)
}

/**
 * Home ranking strip candidates (issue #81): a narrow select, distinct from
 * `EVENTS_SELECT`, because it's the only generic listing that needs venue
 * lat/lng — for the proximity factor. `EVENTS_SELECT` stays as-is; adding
 * lat/lng there would make every other listing pay for a field it never
 * reads (payload economy).
 */
export const SUGGESTION_CANDIDATES_SELECT = `
  id, name, date,
  venues ( name, city, lat, lng ),
  lineups ( artists ( id, name ) )
`

export interface SuggestionCandidateRow {
  id: string
  name: string
  date: string
  venues: { name: string; city: string | null; lat: unknown; lng: unknown } | null
  lineups: Array<{ artists: { id: string; name: string } | null }>
}

/** Defensive cap, same spirit as MAX_EVENTS — the ranking strip only ever surfaces its top 6. */
export const CANDIDATE_LIMIT = 100
const CANDIDATE_WINDOW_DAYS = 90

/**
 * Catalog events 0–90 days out, from the start of today in Argentina time
 * (same cutoff rule as getUpcomingEvents) — the ranking pure core excludes
 * anything outside this window anyway, so the query keeps the payload small
 * instead of relying on `rankSuggestions` to filter it client-side.
 */
export async function listSuggestionCandidates(now: Date = new Date()): Promise<SuggestionCandidateRow[]> {
  const supabase = await createClient()
  const start = combineDateAndTime(todayDateOnly(now), '00:00')
  const cutoff = new Date(now.getTime() + CANDIDATE_WINDOW_DAYS * MS_PER_DAY)
  const end = combineDateAndTime(todayDateOnly(cutoff), '00:00')

  const { data, error } = await supabase
    .from('events')
    .select(SUGGESTION_CANDIDATES_SELECT)
    .gte('date', start)
    .lt('date', end)
    .order('date', { ascending: true })
    .limit(CANDIDATE_LIMIT)

  if (error) {
    console.error('Error buscando candidatos de sugerencias:', error)
    return []
  }
  return (data ?? []) as unknown as SuggestionCandidateRow[]
}
