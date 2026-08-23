import { createClient } from '@/src/core/lib/supabase/server'
import { ActionResult } from '@/src/core/types'
import { revalidatePath } from 'next/cache'
import { sanitizeText, sanitizeError } from '@/src/core/lib/validation'

/**
 * Capa de casos de uso del dominio de auth.
 *
 * La escritura del perfil vive acá desde que se borró actions.ts (issue #23):
 * GraphQL es el único transporte de la mutation, así que la función que antes
 * respaldaba tanto a la Server Action como al resolver quedó con un solo
 * caller.
 *
 * La subida del avatar NO pasa por acá: es un File que llega por FormData
 * desde el navegador, algo que el schema no puede recibir sin un scalar
 * Upload configurado en Yoga. Vive en ./avatar-actions.ts, que sigue siendo
 * una Server Action a propósito, y solo escribe en el bucket de storage: la
 * URL que devuelve entra después por `avatar_url` en este upsert, para que
 * todas las escrituras a la tabla `profiles` sigan siendo una sola.
 */

const MAX_FULL_NAME = 200
const MAX_USERNAME = 50
const MAX_WEBSITE = 300
const MAX_LOCATION = 100
const MAX_BIO = 500

export interface ProfileUpdateInput {
    full_name?: string
    username?: string
    bio?: string
    website?: string
    location?: string
    /**
     * URL pública ya subida al bucket (ver ./avatar-actions.ts). Omitirla —
     * no pasarla como undefined — es lo que deja el avatar existente intacto:
     * Supabase arma el UPDATE de un upsert solo con las columnas presentes en
     * el objeto, así que incluir la clave con undefined la pisaría con null.
     */
    avatar_url?: string
}

export async function modifyProfile(input: ProfileUpdateInput): Promise<ActionResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No estás autenticado.' }

    const updates: Record<string, unknown> = {
        id: user.id,
        full_name: sanitizeText(input.full_name, MAX_FULL_NAME),
        username: sanitizeText(input.username, MAX_USERNAME),
        website: sanitizeText(input.website, MAX_WEBSITE),
        bio: sanitizeText(input.bio, MAX_BIO),
        location: sanitizeText(input.location, MAX_LOCATION),
        updated_at: new Date().toISOString(),
    }

    if (input.avatar_url !== undefined) {
        updates.avatar_url = input.avatar_url
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
