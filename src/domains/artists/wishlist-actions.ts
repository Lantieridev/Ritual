'use server'

import { revalidatePath } from 'next/cache'
import { supabase } from '@/src/core/lib/supabase'
import { routes } from '@/src/core/lib/routes'
import { validateUUID, sanitizeError } from '@/src/core/lib/validation'
import { getCurrentUserId } from '@/src/core/auth/session'

/**
 * Obtiene los IDs de artistas en la wishlist del usuario actual.
 */
export async function getWishlistArtistIds(): Promise<string[]> {
    const userId = await getCurrentUserId()
    // console.log('[Wishlist] getWishlistArtistIds user:', userId)
    if (!userId) return [] // Don't throw, just return empty for safety in UI
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

export async function toggleWishlist(
    artistId: string
): Promise<{ inWishlist: boolean; error?: string }> {
    console.log('[Wishlist] Toggling artist:', artistId)

    const idErr = validateUUID(artistId, 'Artista')
    if (idErr) {
        console.error('[Wishlist] Invalid ID:', artistId, idErr)
        return { inWishlist: false, error: idErr }
    }

    const userId = await getCurrentUserId()
    console.log('[Wishlist] User ID:', userId)

    if (!userId) return { inWishlist: false, error: 'Inicia sesión para guardar artistas.' }

    // Verificar si ya existe
    const { data: existing, error: selectError } = await supabase
        .from('wishlist')
        .select('id')
        .eq('user_id', userId)
        .eq('artist_id', artistId)
        .single()

    if (selectError && selectError.code !== 'PGRST116') {
        console.error('[Wishlist] Check error:', selectError)
        return { inWishlist: false, error: 'Error al verificar wishlist.' }
    }

    if (existing) {
        // Quitar de wishlist
        console.log('[Wishlist] Removing...')
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
        console.log('[Wishlist] Adding...')
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
