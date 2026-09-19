import 'server-only'
import crypto from 'node:crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getCurrentUserId } from '@/src/core/auth/session'
import type { ActionResult } from '@/src/core/types'
import { getEventById } from '@/src/domains/events/data'
import { googleCalendarClient } from './client'

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
    const key = process.env.GOOGLE_CALENDAR_ENCRYPTION_KEY
    if (!key || key.length !== 64) {
        throw new Error('GOOGLE_CALENDAR_ENCRYPTION_KEY must be 64 hex characters')
    }
    return Buffer.from(key, 'hex')
}

export function encryptToken(token: string): string {
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)
    let encrypted = cipher.update(token, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')
    return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decryptToken(encryptedData: string): string {
    const [ivHex, authTagHex, encryptedText] = encryptedData.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
}

function getServiceSupabase() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function getGoogleCalendarStatus(): Promise<boolean> {
    const userId = await getCurrentUserId()
    if (!userId) return false

    const supabase = getServiceSupabase()
    const { data, error } = await supabase
        .from('google_calendar_links')
        .select('user_id')
        .eq('user_id', userId)
        .single()
        
    if (error || !data) return false
    return true
}

export async function disconnectGoogleCalendar(): Promise<ActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) return { error: 'No auth' }

    const supabase = getServiceSupabase()
    
    // Attempt to revoke the token with Google
    const { data: linkData } = await supabase
        .from('google_calendar_links')
        .select('refresh_token')
        .eq('user_id', userId)
        .single()
        
    if (linkData?.refresh_token) {
        try {
            const token = decryptToken(linkData.refresh_token)
            await googleCalendarClient.revokeToken(token)
        } catch (error) {
            console.error('Failed to revoke Google Calendar token with Google', error)
            // Continue with local deletion anyway
        }
    }

    const { error } = await supabase
        .from('google_calendar_links')
        .delete()
        .eq('user_id', userId)
        
    if (error) {
        console.error('Failed to delete google_calendar_links', error)
        return { error: 'No se pudo desconectar' }
    }
    return {}
}

export async function connectGoogleCalendar(code: string, redirectUri: string): Promise<ActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) return { error: 'No auth' }

    try {
        const tokens = await googleCalendarClient.exchangeCodeForTokens(code, redirectUri)
        if (!tokens.refresh_token) {
            return { error: 'No refresh token received. User might need to re-authorize.' }
        }

        const supabase = getServiceSupabase()
        const { error } = await supabase
            .from('google_calendar_links')
            .upsert({
                user_id: userId,
                refresh_token: encryptToken(tokens.refresh_token),
                updated_at: new Date().toISOString(),
            })

        if (error) {
            console.error('Failed to save google_calendar_links', error)
            return { error: 'No se pudo guardar la conexión' }
        }

        return {}
    } catch (err) {
        console.error('Failed to connect Google Calendar', err)
        return { error: 'No se pudo conectar la cuenta' }
    }
}

export async function syncEventToGoogleCalendar(eventId: string): Promise<ActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) return { error: 'No auth' }

    const supabase = getServiceSupabase()
    const { data: linkData, error: linkError } = await supabase
        .from('google_calendar_links')
        .select('refresh_token')
        .eq('user_id', userId)
        .single()
        
    if (linkError || !linkData) {
        // No connected calendar, this is not an error but just a no-op
        return {}
    }

    const event = await getEventById(eventId)
    if (!event) return { error: 'Evento no encontrado' }

    // Start time is event.date. We'll set a default 3-hour duration.
    const startTime = new Date(event.date)
    const endTime = new Date(startTime.getTime() + 3 * 60 * 60 * 1000)

    const eventPayload = {
        summary: event.name || event.artists?.[0]?.name || 'Recital',
        description: `Show: ${event.name || event.artists?.[0]?.name}\nVenue: ${event.venue?.name}\nhttps://ritual.app/events/${eventId}`,
        start: { dateTime: startTime.toISOString() },
        end: { dateTime: endTime.toISOString() }
    }

    const refreshToken = decryptToken(linkData.refresh_token)

    let newAccessToken: string
    try {
        newAccessToken = await googleCalendarClient.refreshAccessToken(refreshToken)
    } catch (err) {
        console.error('Failed to refresh Google Calendar token, removing link', err)
        await supabase.from('google_calendar_links').delete().eq('user_id', userId)
        return { error: 'La conexión expiró o fue revocada. Volvé a conectar tu cuenta.' }
    }

    // Check if we already created an event
    const { data: existingMapping } = await supabase
        .from('google_calendar_events')
        .select('google_event_id')
        .eq('user_id', userId)
        .eq('event_id', eventId)
        .single()

    try {
        if (existingMapping?.google_event_id) {
            // Update
            await googleCalendarClient.updateEvent(newAccessToken, existingMapping.google_event_id, eventPayload)
        } else {
            // Insert
            const googleEventId = await googleCalendarClient.insertEvent(newAccessToken, eventPayload)
            await supabase
                .from('google_calendar_events')
                .insert({
                    user_id: userId,
                    event_id: eventId,
                    google_event_id: googleEventId,
                })
        }
        return {}
    } catch (err) {
        console.error('Failed to sync event to Google Calendar', err)
        return { error: 'No se pudo sincronizar con Google Calendar' }
    }
}
