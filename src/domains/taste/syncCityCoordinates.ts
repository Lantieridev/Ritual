import { geocodeCity } from '@/src/core/lib/nominatim'
import type { createClient } from '@/src/core/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Backs the profile's `after()` hook and the daily backfill cron (spec "City
 * geocoding with graceful failure"): `geocodeCity` never throws, so on
 * failure this just leaves the coordinates untouched for the next attempt
 * instead of erroring the caller.
 */
export async function syncCityCoordinates(supabase: SupabaseClient, userId: string, city: string): Promise<void> {
    const { lat, lng } = await geocodeCity(city)
    if (lat === null || lng === null) return

    const { error } = await supabase.from('taste_profiles').update({ city_lat: lat, city_lng: lng }).eq('user_id', userId)
    if (error) console.error('Error guardando coordenadas de ciudad:', error)
}
