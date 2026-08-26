import { createClient } from '@/src/core/lib/supabase/server'
import type { Artist, Venue, EventWithRelations } from '@/src/core/types'
import { escapeLikeWildcards } from '@/src/core/lib/validation'

export type ModeratedEntity = 'artists' | 'venues' | 'events'

/** Una entidad canónica candidata a recibir la fusión, lista para el combobox. */
export interface MergeTarget {
    id: string
    name: string
    /** Dato secundario para desambiguar homónimos: género, ubicación o fecha. */
    detail: string | null
}

const MERGE_TARGET_LIMIT = 8

export async function getUnverifiedArtists(): Promise<Artist[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('artists')
        .select('*')
        .eq('status', 'unverified')
        .order('created_at', { ascending: false })

    if (error) throw error
    return data as Artist[]
}

export async function getUnverifiedVenues(): Promise<Venue[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('status', 'unverified')
        .order('created_at', { ascending: false })

    if (error) throw error
    return data as Venue[]
}

const EVENTS_SELECT = `
  *,
  venues ( name, city, country ),
  lineups (
    artists ( id, name, genre )
  )
`

export async function getUnverifiedEvents(): Promise<EventWithRelations[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('events')
        .select(EVENTS_SELECT)
        .eq('status', 'unverified')
        .order('date', { ascending: true })

    if (error) throw error
    return data as unknown as EventWithRelations[]
}

const MERGE_TARGET_COLUMNS: Record<ModeratedEntity, string> = {
    artists: 'id, name, genre',
    venues: 'id, name, city, address',
    events: 'id, name, date',
}

function toMergeTarget(entityType: ModeratedEntity, row: Record<string, unknown>): MergeTarget {
    const id = String(row.id)
    const name = (row.name as string | null) ?? 'Sin nombre'

    if (entityType === 'artists') {
        return { id, name, detail: (row.genre as string | null) ?? null }
    }

    if (entityType === 'venues') {
        const parts = [row.city, row.address].filter(Boolean) as string[]
        return { id, name, detail: parts.length ? parts.join(' — ') : null }
    }

    return { id, name, detail: (row.date as string | null) ?? null }
}

/**
 * Busca la entidad canónica hacia la que fusionar. Espejo del tool
 * `search_catalog` del servidor MCP (`mcp/src/index.ts`): sólo candidatos ya
 * verificados, para que una fusión no mande el historial a otro duplicado
 * pendiente. Se apoya en los índices GIN trigram de
 * 20260824205500_performance_indexes.sql.
 */
export async function searchMergeTargets(
    entityType: ModeratedEntity,
    query: string,
    excludeId?: string
): Promise<MergeTarget[]> {
    const term = query.trim()
    if (!term) return []

    const supabase = await createClient()
    let request = supabase
        .from(entityType)
        .select(MERGE_TARGET_COLUMNS[entityType])
        .eq('status', 'verified')
        .ilike('name', `%${escapeLikeWildcards(term)}%`)
        .order('name', { ascending: true })
        .limit(MERGE_TARGET_LIMIT)

    if (excludeId) request = request.neq('id', excludeId)

    const { data, error } = await request
    if (error) throw error

    // El nombre de la tabla es dinámico, así que el cliente de Supabase no
    // puede inferir la forma de la fila y cae en GenericStringError. La lista
    // de columnas por entidad la fija MERGE_TARGET_COLUMNS acá al lado.
    const rows = (data ?? []) as unknown as Record<string, unknown>[]
    return rows.map((row) => toMergeTarget(entityType, row))
}
