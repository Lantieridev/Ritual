import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/src/core/lib/supabase/server'
import { getCurrentUserId } from '@/src/core/auth/session'

export interface GraphQLContext {
    supabase: SupabaseClient
    userId: string | null
}

export async function createGraphQLContext(): Promise<GraphQLContext> {
    const supabase = await createClient()
    const userId = await getCurrentUserId()
    return { supabase, userId }
}
