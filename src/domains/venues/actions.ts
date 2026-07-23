'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { routes } from '@/src/core/lib/routes'
import { sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import { findOrCreateByName } from '@/src/core/lib/find-or-create'
import { getCurrentUserId } from '@/src/core/auth/session'
import type { ActionResult, VenueCreateInput } from '@/src/core/types'

const MAX_NAME = 200
const MAX_CITY = 100
const MAX_ADDRESS = 300
const MAX_COUNTRY = 100

/**
 * Inserta la sede y devuelve su id — sin redirigir, para que tanto la
 * Server Action (que sí redirige tras un submit de formulario) como la
 * mutation de GraphQL (que nunca debería redirigir, la navegación la
 * decide el cliente) compartan la misma lógica de inserción y manejo de
 * duplicados en un solo lugar.
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

export async function createVenue(formData: VenueCreateInput): Promise<ActionResult<{ existingId?: string }>> {
  const result = await insertVenue(formData)
  if (result.error) return result
  redirect(routes.venues.list)
}

/**
 * Busca una sede por nombre o la crea, sin redirigir — para el
 * autocompletado inline del formulario de recital: si la sede no existe
 * todavía, se puede crear sin abandonar el form ni perder lo ya cargado.
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
