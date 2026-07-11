import { createClient } from '@/src/core/lib/supabase/server'
import { sanitizeError } from '@/src/core/lib/validation'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Busca una fila por nombre (case-insensitive) en una tabla y la crea si no existe.
 * Usado para no duplicar venues/artists al importar eventos de fuentes externas.
 *
 * Atómico: intenta insertar primero (upsert con ignoreDuplicates sobre el
 * constraint único de `name_key`, la versión en minúsculas de `name`). Si la
 * fila ya existía, el insert no hace nada y devuelve 0 filas — en ese caso
 * se busca la fila existente por separado. Esto evita el TOCTOU de un
 * select-then-insert (dos clicks concurrentes en "Agregar" podían crear
 * dos venues/artists duplicados) sin pisar los campos de una fila ya
 * existente con datos posiblemente vacíos del nuevo intento.
 */
export async function findOrCreateByName(
    supabase: SupabaseClient,
    table: 'venues' | 'artists',
    name: string,
    extraFields: Record<string, unknown> = {}
): Promise<{ id: string } | { error: string }> {
    const { data: created, error: upsertError } = await supabase
        .from(table)
        .upsert(
            { name, ...extraFields },
            { onConflict: 'name_key', ignoreDuplicates: true }
        )
        .select('id')
        .maybeSingle()

    if (upsertError) {
        console.error(`Error creando ${table}:`, upsertError)
        return { error: sanitizeError(upsertError) }
    }

    if (created) return { id: created.id }

    // La fila ya existía (el insert fue ignorado por el conflicto) — buscarla.
    // Se usa name_key (no ilike sobre name) para que el match sea exactamente
    // el mismo que usó el constraint único: ilike trata % y _ como wildcards,
    // lo que podría matchear de más si el nombre los contuviera literalmente.
    const { data: existing, error: selectError } = await supabase
        .from(table)
        .select('id')
        .eq('name_key', name.toLowerCase())
        .limit(1)
        .single()

    if (selectError || !existing) {
        console.error(`Error buscando ${table} existente:`, selectError)
        return { error: sanitizeError(selectError) }
    }

    return { id: existing.id }
}
