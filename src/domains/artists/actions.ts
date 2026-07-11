'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { routes } from '@/src/core/lib/routes'
import type { ArtistCreateInput } from '@/src/core/types'

export async function createArtist(formData: ArtistCreateInput): Promise<{ error?: string }> {
  const name = formData.name?.trim()
  if (!name) return { error: 'El nombre del artista es obligatorio.' }
  const supabase = await createClient()
  const { error } = await supabase.from('artists').insert({
    name,
    genre: formData.genre?.trim() || null,
  })
  if (error) {
    console.error('Error creando artista:', error)
    return { error: error.message }
  }
  redirect(routes.artists.list)
}
