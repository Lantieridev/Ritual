import { createClient } from '@/src/core/lib/supabase/server'
import { sanitizeError } from '@/src/core/lib/validation'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Busca una fila por nombre (case-insensitive) en una tabla y la crea si no existe.
 * Usado para no duplicar venues/artists al importar eventos de fuentes externas.
 */
export async function findOrCreateByName(
    supabase: SupabaseClient,
    table: 'venues' | 'artists',
    name: string,
    extraFields: Record<string, unknown> = {}
): Promise<{ id: string } | { error: string }> {
    const { data: existing } = await supabase
        .from(table)
        .select('id')
        .ilike('name', name)
        .limit(1)

    if (existing?.[0]) return { id: existing[0].id }

    const { data: created, error } = await supabase
        .from(table)
        .insert({ name, ...extraFields })
        .select('id')
        .single()

    if (error || !created) {
        console.error(`Error creando ${table}:`, error)
        return { error: sanitizeError(error) }
    }

    return { id: created.id }
}
