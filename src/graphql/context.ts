import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/src/core/lib/supabase/server'
import { getCurrentUserId } from '@/src/core/auth/session'

export interface GraphQLContext {
    supabase: SupabaseClient
    userId: string | null
    role: 'usuario' | 'moderador' | 'admin' | null
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
            role = 'usuario' // Safe fallback
        }
    }

    return { supabase, userId, role }
}
