import { createClient } from '@/src/core/lib/supabase/server'
import { getCurrentUserId } from '@/src/core/auth/session'
import { sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import type { ActionResult } from '@/src/core/types'

const MAX_BODY = 1000

export interface EventMessage {
    id: string
    user_id: string
    body: string
    created_at: string
    /** null si el perfil no tiene username cargado, o si el autor borró la cuenta. */
    author_username: string | null
}

/**
 * Mensajes del thread de coordinación de un evento — issue #59. RLS ya
 * filtra por attendance; acá sólo se resuelve el nombre del autor, que no
 * tiene FK directa desde event_messages (user_id apunta a auth.users, no a
 * profiles) así que no se puede embeber en una sola query de PostgREST.
 */
export async function getEventMessages(eventId: string): Promise<EventMessage[]> {
    const supabase = await createClient()
    const { data: messages, error } = await supabase
        .from('event_messages')
        .select('id, user_id, body, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error cargando mensajes del evento:', error)
        return []
    }
    if (!messages || messages.length === 0) return []

    const userIds = [...new Set(messages.map((m) => m.user_id))]
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds)

    const usernameById = new Map((profiles ?? []).map((p) => [p.id, p.username as string | null]))

    return messages.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        body: m.body,
        created_at: m.created_at,
        author_username: usernameById.get(m.user_id) ?? null,
    }))
}

export async function addEventMessage(eventId: string, body: string): Promise<ActionResult<{ id?: string }>> {
    const userId = await getCurrentUserId()
    if (!userId) return { error: 'Usuario no autenticado' }

    const cleanBody = sanitizeText(body, MAX_BODY)
    if (!cleanBody) return { error: 'El mensaje no puede estar vacío.' }

    const supabase = await createClient()
    const { data, error } = await supabase
        .from('event_messages')
        .insert({ event_id: eventId, user_id: userId, body: cleanBody })
        .select('id')
        .single()

    if (error) {
        console.error('Error enviando mensaje del evento:', error)
        // RLS bloquea el insert (sin attendance en este evento) devolviendo
        // un error de policy, no un array vacío -- a diferencia del patrón
        // de delete, acá sí llega error real.
        if (error.code === '42501') {
            return { error: 'Necesitás marcar tu asistencia a este show para escribir acá.' }
        }
        return { error: sanitizeError(error) }
    }
    return { id: data.id }
}
