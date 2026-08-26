import { createClient } from '@/src/core/lib/supabase/server'
import type { Artist, Venue, EventWithRelations } from '@/src/core/types'
import {
    getUnverifiedArtists,
    getUnverifiedVenues,
    getUnverifiedEvents,
    searchMergeTargets as searchMergeTargetsData,
} from './data'
import type { ModeratedEntity, MergeTarget } from './data'

export type { ModeratedEntity, MergeTarget }

/**
 * Use-case / application-service layer for the moderation domain.
 *
 * `data.ts` sólo lee (unverified* y la búsqueda de merge targets); el lado de
 * escritura vive acá porque cada aprobación y fusión pasa por un RPC con su
 * propia validación de rol server-side (ver approveEntity), no por un INSERT
 * o UPDATE simple — mismo patrón que `removeEvent`/`removeFestival` en sus
 * dominios.
 */

/** Artistas pendientes de revisión, más nuevos primero. */
export async function listUnverifiedArtists(): Promise<Artist[]> {
    return getUnverifiedArtists()
}

/** Sedes pendientes de revisión, más nuevas primero. */
export async function listUnverifiedVenues(): Promise<Venue[]> {
    return getUnverifiedVenues()
}

/** Eventos pendientes de revisión, ordenados por fecha del recital. */
export async function listUnverifiedEvents(): Promise<EventWithRelations[]> {
    return getUnverifiedEvents()
}

/** Busca la entidad verificada hacia la que fusionar, por nombre. */
export async function searchMergeTargets(
    entityType: ModeratedEntity,
    query: string,
    excludeId?: string
): Promise<MergeTarget[]> {
    return searchMergeTargetsData(entityType, query, excludeId)
}

/**
 * La aprobación pasa por RPC y no por un UPDATE directo: el cliente de
 * @supabase/ssr corre con el JWT del usuario, y `artists`/`venues` no tienen
 * policy de UPDATE. RLS denegaba, PostgREST devolvía 0 filas sin error, y la
 * aprobación fallaba en silencio reportando éxito. Ver
 * 20260825060000_moderation_approve_and_status_guard.sql.
 */
async function approveEntity(entityType: ModeratedEntity, id: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.rpc('approve_entity', {
        entity_type: entityType,
        entity_id: id,
    })
    if (error) throw error
}

export async function approveArtist(id: string): Promise<void> {
    return approveEntity('artists', id)
}

export async function approveVenue(id: string): Promise<void> {
    return approveEntity('venues', id)
}

export async function approveEvent(id: string): Promise<void> {
    return approveEntity('events', id)
}

export async function mergeArtists(sourceId: string, targetId: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.rpc('merge_artists', { source_id: sourceId, target_id: targetId })
    if (error) throw error
}

export async function mergeVenues(sourceId: string, targetId: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.rpc('merge_venues', { source_id: sourceId, target_id: targetId })
    if (error) throw error
}

export async function mergeEvents(sourceId: string, targetId: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.rpc('merge_events', { source_id: sourceId, target_id: targetId })
    if (error) throw error
}
