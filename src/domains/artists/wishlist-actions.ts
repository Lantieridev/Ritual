'use server'

import { revalidatePath } from 'next/cache'
import { supabase } from '@/src/core/lib/supabase'
import { routes } from '@/src/core/lib/routes'
import { validateUUID, sanitizeError } from '@/src/core/lib/validation'
import { getDevUserId } from '@/src/core/lib/env'

/**
 * Obtiene los IDs de artistas en la wishlist del usuario actual.
 */
export async function getWishlistArtistIds(): Promise<string[]> {
    const userId = getDevUserId()
    const { data } = await supabase
        .from('wishlist')
        .select('artist_id')
        .eq('user_id', userId)
    return (data ?? []).map((r) => r.artist_id)
}

/**
 * Agrega o quita un artista de la wishlist (toggle).
 * Devuelve el nuevo estado: true = está en wishlist, false = no está.
 */
export async function toggleWishlist(
    artistId: string
): Promise<{ inWishlist: boolean; error?: string }> {
    const idErr = validateUUID(artistId, 'Artista')
    if (idErr) return { inWishlist: false, error: idErr }

    const userId = getDevUserId()

    // Verificar si ya existe
    const { data: existing } = await supabase
        .from('wishlist')
        .select('id')
        .eq('user_id', userId)
        .eq('artist_id', artistId)
        .single()

    if (existing) {
        // Quitar de wishlist
        const { error } = await supabase
            .from('wishlist')
            .delete()
            .eq('id', existing.id)
        if (error) return { inWishlist: true, error: sanitizeError(error) }
        revalidatePath(routes.artists.detail(artistId))
        revalidatePath('/wishlist')
        return { inWishlist: false }
    } else {
        // Agregar a wishlist
        const { error } = await supabase
            .from('wishlist')
            .insert({ user_id: userId, artist_id: artistId })
        if (error) return { inWishlist: false, error: sanitizeError(error) }
        revalidatePath(routes.artists.detail(artistId))
        revalidatePath('/wishlist')
        return { inWishlist: true }
    }
}
