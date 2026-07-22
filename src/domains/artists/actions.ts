'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { routes } from '@/src/core/lib/routes'
import { sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import { findOrCreateByName } from '@/src/core/lib/find-or-create'
import { getCurrentUserId } from '@/src/core/auth/session'
import type { ActionResult, ArtistCreateInput } from '@/src/core/types'

const MAX_NAME = 200
const MAX_GENRE = 100

export async function createArtist(formData: ArtistCreateInput): Promise<ActionResult<{ existingId?: string }>> {
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
    // El artista ya existe (constraint artists_name_key_unique) — en vez del
    // mensaje genérico de sanitizeError, buscamos la fila existente para
    // que el usuario pueda ir directo a usarla en vez de quedar sin salida.
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('artists')
        .select('id')
        .ilike('name', name)
        .single()
      return { error: 'Ya existe un artista con ese nombre.', existingId: existing?.id }
    }
    return { error: sanitizeError(error) }
  }
  redirect(routes.artists.list)
}

/**
 * Busca un artista por nombre o lo crea, sin redirigir — para el
 * autocompletado inline del formulario de recital.
 */
export async function findOrCreateArtist(
  name: string,
  genre?: string
): Promise<ActionResult<{ id?: string }>> {
  const userId = await getCurrentUserId()
  if (!userId) return { error: 'Usuario no autenticado' }

  const cleanName = sanitizeText(name, MAX_NAME)
  if (!cleanName) return { error: 'El nombre del artista es obligatorio.' }

  const supabase = await createClient()
  const result = await findOrCreateByName(supabase, 'artists', cleanName, {
    genre: sanitizeText(genre, MAX_GENRE),
  })
  if ('error' in result) return { error: result.error }

  return { id: result.id }
}
