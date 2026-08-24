import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/src/core/lib/supabase/server'
import { getCurrentUserId } from '@/src/core/auth/session'
import type { UserRole } from '@/src/core/types'

export interface GraphQLContext {
    supabase: SupabaseClient
    userId: string | null
    role: UserRole | null
}

export async function createGraphQLContext(): Promise<GraphQLContext> {
    const supabase = await createClient()
    const userId = await getCurrentUserId()
    let role: GraphQLContext['role'] = null

    if (userId) {
        // Fetch the user's role bypassing RLS via our new function
        const { data, error } = await supabase.rpc('get_user_role', { user_id: userId })
        if (!error && data) {
            role = data as GraphQLContext['role']
        } else {
            // Fail closed to the lowest privilege, but log it — this branch can
            // fire on every request during a DB blip, silently downgrading an
            // admin/moderador session with no trace otherwise.
            if (error) {
                console.error('get_user_role RPC failed, falling back to usuario:', error)
            }
            role = 'usuario'
        }
    }

    return { supabase, userId, role }
}
