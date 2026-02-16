'use server'

import { redirect } from 'next/navigation'
import { supabase } from '@/src/lib/supabase'
import type { VenueCreateInput } from '@/src/lib/types'

/**
 * Crea una nueva sede.
 * Server Action; redirige al listado de sedes tras insertar.
 */
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

  redirect('/venues')
}
