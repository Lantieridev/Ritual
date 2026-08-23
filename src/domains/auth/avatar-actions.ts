'use server'

import { createClient } from '@/src/core/lib/supabase/server'
import type { ActionResult } from '@/src/core/types'

/**
 * Subida del avatar de perfil.
 *
 * Sigue siendo una Server Action a propósito, no una mutation de GraphQL: el
 * navegador manda un File dentro de un FormData, y recibir eso por GraphQL
 * necesita un scalar Upload y el manejo de multipart configurados en Yoga,
 * que no lo están. Las Server Actions manejan FormData de forma nativa, así
 * que este es el transporte correcto para el archivo — mismo criterio que
 * uploadEventPhoto() en el dominio de eventos.
 *
 * Escribe solo en el bucket de storage y devuelve la URL pública. La tabla
 * `profiles` la escribe modifyProfile() por GraphQL, en el mismo upsert que
 * los campos de texto, para que guardar el perfil siga siendo una sola
 * escritura y no dos que puedan quedar desincronizadas.
 */

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function uploadAvatar(formData: FormData): Promise<ActionResult<{ avatarUrl?: string }>> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No estás autenticado.' }

    const file = formData.get('avatar') as File | null
    if (!file || file.size === 0) return { error: 'No se recibió ninguna imagen.' }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
        return { error: 'La imagen no puede superar 5MB.' }
    }
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
        return { error: 'Formato no soportado. Usá JPG, PNG, WebP o GIF.' }
    }

    const fileExt = file.name.split('.').pop()
    const filePath = `${user.id}-${Math.random()}.${fileExt}`

    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
    if (uploadError) {
        console.error('Upload error:', uploadError)
        return { error: 'Error al subir la imagen. Asegúrate de que el bucket "avatars" exista y sea público.' }
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
    return { avatarUrl: publicUrl }
}
