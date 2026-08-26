import 'server-only'
import { cache } from 'react'
import { isAuthSessionMissingError } from '@supabase/supabase-js'
import { createClient } from '@/src/core/lib/supabase/server'

/**
 * Returns the current authenticated user's ID.
 * Returns null if no session exists or error occurs.
 * Use this instead of getDevUserId().
 *
 * Va envuelto en `cache()` de React porque `supabase.auth.getUser()` sale al
 * servidor de Auth a revalidar el JWT en cada llamada (a diferencia de
 * `getSession()`, que resuelve local). Hay unos 40 puntos de llamada y un
 * render del home encadenaba cinco validaciones del mismo token en el mismo
 * request: el middleware, getEventsWithAttendance, createGraphQLContext,
 * getWishlistArtistIds y getFestivals. El scope de `cache()` es el request,
 * así que deduplica sin riesgo de cruzar sesiones entre usuarios.
 */
export const getCurrentUserId = cache(async function getCurrentUserId(): Promise<string | null> {
    const supabase = await createClient()
    try {
        const { data: { user }, error: getUserError } = await supabase.auth.getUser()
        if (getUserError && !isAuthSessionMissingError(getUserError)) {
            console.error('supabase.auth.getUser() failed in getCurrentUserId:', getUserError)
        }
        return user?.id ?? null
    } catch (error) {
        console.error('Error fetching current user:', error)
        return null
    }
})
