import { createClient } from '@/src/core/lib/supabase/server'
import { sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import { findOrCreateByName } from '@/src/core/lib/find-or-create'
import { geocodeVenue } from '@/src/core/lib/nominatim'
import { getCurrentUserId } from '@/src/core/auth/session'
import type { ActionResult, Venue, VenueCreateInput } from '@/src/core/types'
import { getVenues, getVenueById, getVenueEventsBatch } from './data'
import type { VenueWithEvents, VenueEvent } from './data'

export type { VenueWithEvents, VenueEvent }

/**
 * Use-case / application-service layer for the venues domain.
 *
 * Server Components (app/venues/**, app/coleccion, app/events/**) and the
 * GraphQL resolver (src/graphql/venues.ts) call through here instead of
 * importing ./data directly — see issue #25. This is the seam: swapping the
 * data source or schema later (moving off Supabase, renaming a column) only
 * requires changes in data.ts and here, never in a page component or the
 * GraphQL layer.
 *
 * The write side lives here too, now that actions.ts is gone (issue #23):
 * GraphQL is the only transport for venue mutations, so the redirect-free
 * core functions that used to back both the Server Action and the resolver
 * only have one caller left, and this is where it belongs.
 */

const MAX_NAME = 200
const MAX_CITY = 100
const MAX_ADDRESS = 300
const MAX_COUNTRY = 100

/** Lists every venue in the shared catalog, alphabetically. */
export async function listVenues(): Promise<Venue[]> {
  return getVenues()
}

/** Finds one venue by id, with its show history attached. */
export async function findVenueById(id: string): Promise<VenueWithEvents | null> {
  return getVenueById(id)
}

/** Versión por lote de `findVenueById(...).events`, para el DataLoader de `Venue.events`. */
export async function listVenueEventsBatch(venueIds: readonly string[]): Promise<VenueEvent[][]> {
  return getVenueEventsBatch(venueIds)
}

/**
 * Inserta la sede y devuelve su id. Nunca redirige — la navegación después
 * de crear la decide el cliente, que es quien dispara la mutation.
 */
export async function insertVenue(
  formData: VenueCreateInput
): Promise<ActionResult<{ id?: string; existingId?: string }>> {
  const userId = await getCurrentUserId()
  if (!userId) return { error: 'Usuario no autenticado' }

  const name = sanitizeText(formData.name, MAX_NAME)
  if (!name) return { error: 'El nombre de la sede es obligatorio.' }

  const city = sanitizeText(formData.city, MAX_CITY)
  const address = sanitizeText(formData.address, MAX_ADDRESS)
  const country = sanitizeText(formData.country, MAX_COUNTRY)

  // Las coordenadas se resuelven acá y no en un job posterior porque son lo
  // que enciende el clima del show: una sede recién creada ya lo muestra.
  // `geocodeVenue` nunca tira y devuelve null ante cualquier problema, así que
  // la sede se crea igual sin coordenadas — no vale bloquear un alta por un
  // servicio de terceros (ADR 0003).
  const { lat, lng } = await geocodeVenue({ name, address, city, country })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('venues')
    .insert({
      name,
      city,
      address,
      country,
      lat,
      lng,
    })
    .select('id')
    .single()
  if (error) {
    console.error('Error creando sede:', error)
    // La sede ya existe (constraint venues_name_key_unique) — en vez del
    // mensaje genérico de sanitizeError, buscamos la fila existente para
    // que el usuario pueda ir directo a usarla en vez de quedar sin salida.
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('venues')
        .select('id')
        .ilike('name', name)
        .single()
      return { error: 'Ya existe una sede con ese nombre.', existingId: existing?.id }
    }
    return { error: sanitizeError(error) }
  }
  return { id: data.id }
}

/**
 * Busca una sede por nombre o la crea — para el autocompletado inline del
 * formulario de recital: si la sede no existe todavía, se puede crear sin
 * abandonar el form ni perder lo ya cargado.
 */
export async function findOrCreateVenue(
  name: string,
  city?: string,
  country?: string
): Promise<ActionResult<{ id?: string }>> {
  const userId = await getCurrentUserId()
  if (!userId) return { error: 'Usuario no autenticado' }

  const cleanName = sanitizeText(name, MAX_NAME)
  if (!cleanName) return { error: 'El nombre de la sede es obligatorio.' }

  const cleanCity = sanitizeText(city, MAX_CITY)
  const cleanCountry = sanitizeText(country, MAX_COUNTRY)

  // Se geocodifica antes del upsert y no después porque `findOrCreateByName`
  // es atómico y no distingue "creada" de "ya existía". En la práctica este
  // camino viene del combobox, que sólo ofrece "+ Crear" cuando no hubo match,
  // así que casi siempre es un alta real. `ignoreDuplicates` protege el caso
  // de carrera: si la sede ya existía, sus coordenadas no se pisan.
  const { lat, lng } = await geocodeVenue({
    name: cleanName,
    city: cleanCity,
    country: cleanCountry,
  })

  const supabase = await createClient()
  const result = await findOrCreateByName(supabase, 'venues', cleanName, {
    city: cleanCity,
    country: cleanCountry,
    lat,
    lng,
  })
  if ('error' in result) return { error: result.error }

  return { id: result.id }
}
