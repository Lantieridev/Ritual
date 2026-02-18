'use server'

import { createClient } from '@/src/core/lib/supabase/server'
import { Profile } from '@/src/core/types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

export async function updateProfile(prevState: any, formData: FormData): Promise<ProfileState> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'No estás autenticado.' }

    const full_name = formData.get('full_name') as string
    const username = formData.get('username') as string
    const bio = formData.get('bio') as string
    const website = formData.get('website') as string
    const location = formData.get('location') as string

    // Avatar handling
    const avatarFile = formData.get('avatar') as File
    let avatar_url = formData.get('current_avatar_url') as string

    if (avatarFile && avatarFile.size > 0) {
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
