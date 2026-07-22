import 'server-only'
import { createClient } from '@/src/core/lib/supabase/server'

/**
 * Returns the current authenticated user's ID.
 * Returns null if no session exists or error occurs.
 * Use this instead of getDevUserId().
 */
export async function getCurrentUserId(): Promise<string | null> {
    const supabase = await createClient()
    try {
        const { data: { user }, error: getUserError } = await supabase.auth.getUser()
        if (getUserError) {
            console.error('supabase.auth.getUser() failed in getCurrentUserId:', getUserError)
        }
        return user?.id ?? null
    } catch (error) {
        console.error('Error fetching current user:', error)
        return null
    }
}
