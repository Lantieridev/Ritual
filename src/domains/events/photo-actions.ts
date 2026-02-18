'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/src/core/lib/supabase/server'
import { routes } from '@/src/core/lib/routes'
import { validateUUID, sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import { getCurrentUserId } from '@/src/core/auth/session'

const MAX_CAPTION_LENGTH = 200
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const BUCKET = 'event-photos'

export interface EventPhoto {
    id: string
    event_id: string
    storage_path: string
    caption: string | null
    created_at: string
    url: string
}

/**
 * Obtiene todas las fotos de un evento con URLs públicas.
 */
export async function getEventPhotos(eventId: string): Promise<EventPhoto[]> {
    const idErr = validateUUID(eventId, 'Evento')
    if (idErr) return []

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('event_photos')
        .select('id, event_id, storage_path, caption, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })

    if (error || !data) return []

    return data.map((photo) => ({
        ...photo,
        url: supabase.storage.from(BUCKET).getPublicUrl(photo.storage_path).data.publicUrl,
    }))
}

/**
 * Sube una foto a Supabase Storage y guarda la referencia en la DB.
 * Acepta FormData con campos: eventId, file, caption (opcional).
 */
export async function uploadEventPhoto(
    formData: FormData
): Promise<{ error?: string; photo?: EventPhoto }> {
    const eventId = formData.get('eventId') as string
    const file = formData.get('file') as File | null
    const caption = formData.get('caption') as string | null

    const idErr = validateUUID(eventId, 'Evento')
    if (idErr) return { error: idErr }

    const userId = await getCurrentUserId()
    if (!userId) return { error: 'Debes iniciar sesión para subir fotos.' }

    if (!file || file.size === 0) return { error: 'Seleccioná una imagen.' }
    if (file.size > MAX_FILE_SIZE_BYTES) return { error: 'La imagen no puede superar 5MB.' }
    if (!ALLOWED_TYPES.includes(file.type)) {
        return { error: 'Formato no soportado. Usá JPG, PNG, WebP o GIF.' }
    }

    const supabase = await createClient()

    // Generar path único: eventId/timestamp-filename
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const storagePath = `${eventId}/${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, arrayBuffer, {
            contentType: file.type,
            upsert: false,
        })

    if (uploadError) {
        console.error('Error subiendo foto:', uploadError)
        // Bucket not found — give a clear actionable message
        const msg = uploadError.message?.toLowerCase() ?? ''
        if (msg.includes('bucket') || msg.includes('not found') || uploadError.statusCode === '404') {
            return {
                error: 'El bucket de fotos no existe en Supabase Storage. Crealo en el dashboard: Storage → New bucket → "event-photos" → Public.',
            }
        }
        return { error: sanitizeError(uploadError) }
    }

    const { data: inserted, error: dbError } = await supabase
        .from('event_photos')
        .insert({
            event_id: eventId,
            storage_path: storagePath,
            caption: sanitizeText(caption, MAX_CAPTION_LENGTH),
        })
        .select('id, event_id, storage_path, caption, created_at')
        .single()

    if (dbError || !inserted) {
        // Limpiar el archivo subido si falla el insert
        await supabase.storage.from(BUCKET).remove([storagePath])
        console.error('Error guardando foto en DB:', dbError)
        return { error: sanitizeError(dbError) }
    }

    revalidatePath(routes.events.detail(eventId))

    return {
        photo: {
            ...inserted,
            url: supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl,
        },
    }
}

/**
 * Elimina una foto de Storage y de la DB.
 */
export async function deleteEventPhoto(
    photoId: string,
    eventId: string
): Promise<{ error?: string }> {
    const idErr = validateUUID(photoId, 'Foto')
    if (idErr) return { error: idErr }
    const eventIdErr = validateUUID(eventId, 'Evento')
    if (eventIdErr) return { error: eventIdErr }

    const userId = await getCurrentUserId()
    if (!userId) return { error: 'No autorizado.' }

    const supabase = await createClient()

    const { data: photo, error: fetchErr } = await supabase
        .from('event_photos')
        .select('storage_path')
        .eq('id', photoId)
        .single()

    if (fetchErr || !photo) return { error: 'Foto no encontrada o no tienes permiso.' }

    // Eliminar de Storage
    const { error: storageErr } = await supabase.storage
        .from(BUCKET)
        .remove([photo.storage_path])

    if (storageErr) {
        console.error('Error eliminando foto de Storage:', storageErr)
        // Continuar aunque falle Storage — al menos limpiar la DB
    }

    // Eliminar de DB
    const { error: dbErr } = await supabase
        .from('event_photos')
        .delete()
        .eq('id', photoId)

    if (dbErr) {
        console.error('Error eliminando foto de DB:', dbErr)
        return { error: sanitizeError(dbErr) }
    }

    revalidatePath(routes.events.detail(eventId))
    return {}
}
