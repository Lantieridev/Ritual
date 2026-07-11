'use server'

import { createClient } from '@/src/core/lib/supabase/server'
import { Profile } from '@/src/core/types'
import { revalidatePath } from 'next/cache'
import { sanitizeText } from '@/src/core/lib/validation'

const MAX_FULL_NAME = 200
const MAX_USERNAME = 50
const MAX_WEBSITE = 300
const MAX_LOCATION = 100
const MAX_BIO = 500
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function getProfile(userId?: string): Promise<Profile | null> {
    const supabase = await createClient()

    let targetId = userId

    if (!targetId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null
        targetId = user.id
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetId)
        .single()

    if (error) {
        // If profile doesn't exist, we might want to return a basic object or null
        // But for "My Profile", we usually expect it or creating it on the fly.
        // Let's return null to let UI handle "Create/Edit" state.
        return null
    }

    return data as Profile
}

export interface ProfileState {
    error?: string
    success?: string
    message?: string
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
        return { error: 'Error al actualizar el perfil.' }
    }

    revalidatePath('/profile')
    return { success: 'Perfil actualizado correctamente.' }
}
