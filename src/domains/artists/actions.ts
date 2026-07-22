'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { routes } from '@/src/core/lib/routes'
import { sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import { getCurrentUserId } from '@/src/core/auth/session'
import type { ActionResult, ArtistCreateInput } from '@/src/core/types'

const MAX_NAME = 200
const MAX_GENRE = 100

export async function createArtist(formData: ArtistCreateInput): Promise<ActionResult> {
  const userId = await getCurrentUserId()
  if (!userId) return { error: 'Usuario no autenticado' }

  const name = sanitizeText(formData.name, MAX_NAME)
  if (!name) return { error: 'El nombre del artista es obligatorio.' }
  const supabase = await createClient()
  const { error } = await supabase.from('artists').insert({
    name,
    genre: sanitizeText(formData.genre, MAX_GENRE),
  })
  if (error) {
    console.error('Error creando artista:', error)
    return { error: sanitizeError(error) }
  }
  redirect(routes.artists.list)
}
