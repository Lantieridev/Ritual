'use server'

import { redirect } from 'next/navigation'
import { supabase } from '@/src/lib/supabase'
import type { EventCreateInput } from '@/src/lib/types'

/**
 * Crea un nuevo evento en la base de datos.
 * Server Action: se ejecuta en el servidor; el cliente solo invoca.
 * Tras insertar, redirige al listado para dar feedback visual.
 */
export async function createEvent(formData: EventCreateInput): Promise<{ error?: string }> {
  const { name, date, venue_id } = formData

  if (!name?.trim()) {
    return { error: 'El nombre del recital es obligatorio.' }
  }
  if (!date) {
    return { error: 'La fecha es obligatoria.' }
  }
  if (!venue_id) {
    return { error: 'Debes elegir una sede.' }
  }

  const { error } = await supabase.from('events').insert({
    name: name.trim(),
    date,
    venue_id,
  })

  if (error) {
    console.error('Error creando evento:', error)
    return { error: error.message }
  }

  redirect('/')
}
