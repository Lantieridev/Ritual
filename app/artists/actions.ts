'use server'

import { redirect } from 'next/navigation'
import { supabase } from '@/src/lib/supabase'
import type { ArtistCreateInput } from '@/src/lib/types'

/**
 * Crea un nuevo artista.
 * Server Action; redirige al listado de artistas tras insertar.
 */
export async function createArtist(formData: ArtistCreateInput): Promise<{ error?: string }> {
  const name = formData.name?.trim()
  if (!name) return { error: 'El nombre del artista es obligatorio.' }

  const { error } = await supabase.from('artists').insert({
    name,
    genre: formData.genre?.trim() || null,
  })

  if (error) {
    console.error('Error creando artista:', error)
    return { error: error.message }
  }

  redirect('/artists')
}
