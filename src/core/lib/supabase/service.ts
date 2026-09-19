import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * A service-role client for server code that acts on behalf of the system
 * (writing notifications, reading auth emails), not on behalf of the caller.
 * Null when the env isn't configured; the caller decides how to degrade.
 * Crons use `createCronSupabase` from `./cron`, which does the same for them.
 */
export function createServiceClient(): SupabaseClient | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
        console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para el cliente de servicio.')
        return null
    }
    return createClient(url, key)
}
