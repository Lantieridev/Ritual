import { revalidatePath } from 'next/cache'
import { createClient } from '@/src/core/lib/supabase/server'
import { routes } from '@/src/core/lib/routes'
import { sanitizeText, sanitizeError, validateUUID } from '@/src/core/lib/validation'
import { findOrCreateByName } from '@/src/core/lib/find-or-create'
import { getCurrentUserId } from '@/src/core/auth/session'
import type { ActionResult, Artist, ArtistCreateInput } from '@/src/core/types'
import { getArtists, getArtistById, getArtistEventsBatch } from './data'
import type { ArtistWithEvents, ArtistEvent } from './data'

export type { ArtistWithEvents, ArtistEvent }

/**
 * Use-case / application-service layer for the artists domain.
 *
 * Server Components (app/artists/**, app/coleccion, app/wishlist, app/page)
 * and the GraphQL resolver (src/graphql/artists.ts) call through here instead
 * of importing ./data directly — see issue #25. This is the seam: swapping the
 * data source or schema later (moving off Supabase, renaming a column) only
 * requires changes in data.ts and here, never in a page component or the
 * GraphQL layer.
 *
 * The write side lives here too, now that actions.ts and wishlist-actions.ts
 * are gone (issue #23): GraphQL is the only transport for artist mutations,
 * so the redirect-free core functions that used to back both the Server
 * Action and the resolver only have one caller left.
 */

const MAX_NAME = 200
const MAX_GENRE = 100

/** Lists every artist in the shared catalog, alphabetically. */
export async function listArtists(): Promise<Artist[]> {
  return getArtists()
}

/** Finds one artist by id, with the show history flattened from its lineups. */
export async function findArtistById(id: string): Promise<ArtistWithEvents | null> {
  return getArtistById(id)
}

/** Versión por lote de `findArtistById(...).events`, para el DataLoader de `Artist.events`. */
export async function listArtistEventsBatch(artistIds: readonly string[]): Promise<ArtistEvent[][]> {
  return getArtistEventsBatch(artistIds)
}

/**
 * Inserta el artista y devuelve su id. Nunca redirige — la navegación
 * después de crear la decide el cliente, que es quien dispara la mutation.
 */
export async function insertArtist(
  formData: ArtistCreateInput
): Promise<ActionResult<{ id?: string; existingId?: string }>> {
  const userId = await getCurrentUserId()
  if (!userId) return { error: 'Usuario no autenticado' }

  const name = sanitizeText(formData.name, MAX_NAME)
  if (!name) return { error: 'El nombre del artista es obligatorio.' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('artists')
    .insert({
      name,
      genre: sanitizeText(formData.genre, MAX_GENRE),
    })
    .select('id')
    .single()
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
  return { id: data.id }
}

/**
 * Busca un artista por nombre o lo crea — para el autocompletado inline del
 * formulario de recital.
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

/**
 * Obtiene los IDs de artistas en la wishlist del usuario actual.
 */
export async function getWishlistArtistIds(): Promise<string[]> {
  const userId = await getCurrentUserId()
  if (!userId) return [] // Don't throw, just return empty for safety in UI
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('wishlist')
    .select('artist_id')
    .eq('user_id', userId)

  if (error) {
    console.error('[Wishlist] Error fetching IDs:', error)
    return []
  }
  return (data ?? []).map((r) => r.artist_id)
}

/**
 * Los artistas de la wishlist, con su nombre, no sólo los ids.
 *
 * El home pedía `wishlistArtistIds` más el catálogo COMPLETO de artistas sólo
 * para resolver el nombre de los primeros seis de la wishlist. Traer una tabla
 * entera para cruzarla en memoria contra seis ids es trabajo que la base puede
 * hacer con un join.
 */
export async function getWishlistArtists(): Promise<Array<{ id: string; name: string }>> {
  const userId = await getCurrentUserId()
  if (!userId) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('wishlist')
    .select('artists ( id, name )')
    .eq('user_id', userId)

  if (error) {
    console.error('[Wishlist] Error cargando artistas:', error)
    return []
  }

  const rows = (data ?? []) as unknown as Array<{ artists: { id: string; name: string } | null }>
  return rows
    .map((row) => row.artists)
    .filter((artist): artist is { id: string; name: string } => artist !== null)
}

export async function toggleWishlist(
  artistId: string
): Promise<ActionResult<{ inWishlist: boolean }>> {
  const idErr = validateUUID(artistId, 'Artista')
  if (idErr) {
    console.error('[Wishlist] Invalid ID:', artistId, idErr)
    return { inWishlist: false, error: idErr }
  }

  const userId = await getCurrentUserId()
  if (!userId) return { inWishlist: false, error: 'Inicia sesión para guardar artistas.' }

  const supabase = await createClient()

  // Verificar si ya existe
  const { data: existing, error: selectError } = await supabase
    .from('wishlist')
    .select('id')
    .eq('user_id', userId)
    .eq('artist_id', artistId)
    .single()

  if (selectError && selectError.code !== 'PGRST116') {
    console.error('[Wishlist] Check error:', selectError)
    return { inWishlist: false, error: sanitizeError(selectError) }
  }

  if (existing) {
    // Quitar de wishlist
    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('id', existing.id)
    if (error) {
      console.error('[Wishlist] Delete error:', error)
      return { inWishlist: true, error: sanitizeError(error) }
    }
    revalidatePath(routes.artists.detail(artistId))
    revalidatePath('/wishlist')
    return { inWishlist: false }
  } else {
    // Agregar a wishlist
    const { error } = await supabase
      .from('wishlist')
      .insert({ user_id: userId, artist_id: artistId })
    if (error) {
      console.error('[Wishlist] Insert error:', error)
      return { inWishlist: false, error: sanitizeError(error) }
    }
    revalidatePath(routes.artists.detail(artistId))
    revalidatePath('/wishlist')
    return { inWishlist: true }
  }
}
