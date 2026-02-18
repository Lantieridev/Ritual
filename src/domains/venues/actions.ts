'use server'

import { redirect } from 'next/navigation'
import { supabase } from '@/src/core/lib/supabase'
import { routes } from '@/src/core/lib/routes'
import type { VenueCreateInput } from '@/src/core/types'

export async function createVenue(formData: VenueCreateInput): Promise<{ error?: string }> {
  const name = formData.name?.trim()
  if (!name) return { error: 'El nombre de la sede es obligatorio.' }
  const { error } = await supabase.from('venues').insert({
    name,
    city: formData.city?.trim() || null,
    address: formData.address?.trim() || null,
    country: formData.country?.trim() || null,
  })
  if (error) {
    console.error('Error creando sede:', error)
    return { error: error.message }
  }
  redirect(routes.venues.list)
}
