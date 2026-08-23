import { createClient } from '@/src/core/lib/supabase/server'
import { sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import { findOrCreateByName } from '@/src/core/lib/find-or-create'
import { getCurrentUserId } from '@/src/core/auth/session'
import type { ActionResult, Venue, VenueCreateInput } from '@/src/core/types'
import { getVenues, getVenueById } from './data'
import type { VenueWithEvents } from './data'

export type { VenueWithEvents }

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
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('venues')
    .insert({
      name,
      city: sanitizeText(formData.city, MAX_CITY),
      address: sanitizeText(formData.address, MAX_ADDRESS),
      country: sanitizeText(formData.country, MAX_COUNTRY),
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

  const supabase = await createClient()
  const result = await findOrCreateByName(supabase, 'venues', cleanName, {
    city: sanitizeText(city, MAX_CITY),
    country: sanitizeText(country, MAX_COUNTRY),
  })
  if ('error' in result) return { error: result.error }

  return { id: result.id }
}
