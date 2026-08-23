'use server'

import { createClient } from '@/src/core/lib/supabase/server'
import { ActionResult } from '@/src/core/types'
import { revalidatePath } from 'next/cache'
import { sanitizeText, sanitizeError } from '@/src/core/lib/validation'

const MAX_FULL_NAME = 200
const MAX_USERNAME = 50
const MAX_WEBSITE = 300
const MAX_LOCATION = 100
const MAX_BIO = 500
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export type ProfileState = ActionResult<{ success?: string; message?: string }>

export interface ProfileUpdateInput {
    full_name?: string
    username?: string
    bio?: string
    website?: string
    location?: string
}

/**
 * Actualiza los campos de texto del perfil — sin el manejo de avatar de
 * updateProfile(), que sigue existiendo aparte porque depende de FormData +
 * un File del navegador (el formulario web real de /profile/editar), algo
 * que esta función no necesita para poder usarse desde la mutation de
 * GraphQL. La subida de avatar en sí todavía NO está migrada a GraphQL —
 * requiere soporte de multipart/Upload scalar en el servidor de Yoga, que
 * es trabajo aparte, no solo "portar la mutation".
 *
 * A propósito no incluye `avatar_url` en el upsert cuando no se está
 * tocando el avatar: como Supabase arma el UPDATE de un upsert solo con las
 * columnas presentes en el objeto, omitir la clave entera (en vez de
 * pasarla como undefined) deja el avatar existente intacto en vez de
 * pisarlo con null.
 */
export async function modifyProfile(input: ProfileUpdateInput): Promise<ActionResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No estás autenticado.' }

    const updates = {
        id: user.id,
        full_name: sanitizeText(input.full_name, MAX_FULL_NAME),
        username: sanitizeText(input.username, MAX_USERNAME),
        website: sanitizeText(input.website, MAX_WEBSITE),
        bio: sanitizeText(input.bio, MAX_BIO),
        location: sanitizeText(input.location, MAX_LOCATION),
        updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
        .from('profiles')
        .upsert(updates)
        .select()

    if (error) {
        console.error('Profile update error:', error)
        if (error.code === '23505') {
            return { error: 'Ese nombre de usuario ya está en uso.' }
        }
        return { error: sanitizeError(error) }
    }

    revalidatePath('/profile')
    return {}
}

export async function updateProfile(prevState: ProfileState, formData: FormData): Promise<ProfileState> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'No estás autenticado.' }

    const full_name = sanitizeText(formData.get('full_name') as string, MAX_FULL_NAME)
    const username = sanitizeText(formData.get('username') as string, MAX_USERNAME)
    const bio = sanitizeText(formData.get('bio') as string, MAX_BIO)
    const website = sanitizeText(formData.get('website') as string, MAX_WEBSITE)
    const location = sanitizeText(formData.get('location') as string, MAX_LOCATION)

    // Avatar handling
    const avatarFile = formData.get('avatar') as File
    let avatar_url = formData.get('current_avatar_url') as string

    if (avatarFile && avatarFile.size > 0) {
        if (avatarFile.size > MAX_AVATAR_SIZE_BYTES) {
            return { error: 'La imagen no puede superar 5MB.' }
        }
        if (!ALLOWED_AVATAR_TYPES.includes(avatarFile.type)) {
            return { error: 'Formato no soportado. Usá JPG, PNG, WebP o GIF.' }
        }

        // 1. Upload file
        const fileExt = avatarFile.name.split('.').pop()
        const fileName = `${user.id}-${Math.random()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, avatarFile)

        if (uploadError) {
            console.error('Upload error:', uploadError)
            return { error: 'Error al subir la imagen. Asegúrate de que el bucket "avatars" exista y sea público.' }
        }

        // 2. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath)

        avatar_url = publicUrl
    }

    const updates = {
        id: user.id,
        full_name,
        username,
        website,
        bio,
        location,
        avatar_url,
        updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
        .from('profiles')
        .upsert(updates)
        .select()

    if (error) {
        console.error('Profile update error:', error)
        if (error.code === '23505') { // Unique violation for username
            return { error: 'Ese nombre de usuario ya está en uso.' }
        }
        return { error: sanitizeError(error) }
    }

    revalidatePath('/profile')
    return { success: 'Perfil actualizado correctamente.' }
}
