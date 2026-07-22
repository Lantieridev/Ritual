'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { routes } from '@/src/core/lib/routes'
import { sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import { getCurrentUserId } from '@/src/core/auth/session'
import type { ActionResult, VenueCreateInput } from '@/src/core/types'

const MAX_NAME = 200
const MAX_CITY = 100
const MAX_ADDRESS = 300
const MAX_COUNTRY = 100

export async function createVenue(formData: VenueCreateInput): Promise<ActionResult> {
  const userId = await getCurrentUserId()
  if (!userId) return { error: 'Usuario no autenticado' }

  const name = sanitizeText(formData.name, MAX_NAME)
  if (!name) return { error: 'El nombre de la sede es obligatorio.' }
  const supabase = await createClient()
  const { error } = await supabase.from('venues').insert({
    name,
    city: sanitizeText(formData.city, MAX_CITY),
    address: sanitizeText(formData.address, MAX_ADDRESS),
    country: sanitizeText(formData.country, MAX_COUNTRY),
  })
  if (error) {
    console.error('Error creando sede:', error)
    return { error: sanitizeError(error) }
  }
  redirect(routes.venues.list)
}
