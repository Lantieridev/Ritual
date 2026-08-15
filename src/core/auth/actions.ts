'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { routes } from '@/src/core/lib/routes'
import { sanitizeAuthError } from '@/src/core/lib/validation'
import { listGenres } from '@/src/domains/taste/service'
import { parseSignupTaste } from '@/src/domains/taste/parseSignupTaste'

type AuthActionState = { error: string } | { success: string } | null

const SIGNUP_SUCCESS_MESSAGE = 'Revisá tu email para confirmar la cuenta.'
const RESET_REQUEST_SUCCESS_MESSAGE = 'Si el email está registrado, te enviamos las instrucciones para restablecer tu contraseña.'

export async function login(prevState: AuthActionState, formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: sanitizeAuthError(error) }
    }

    revalidatePath('/', 'layout')
    redirect(routes.home)
}

export async function signup(prevState: AuthActionState, formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const location = (formData.get('location') as string | null)?.trim()

    // Los géneros y el año de nacimiento son opcionales y nunca bloquean el
    // alta: dejarlos en blanco siempre pasa. Un año fuera de rango sí corta
    // acá (mismo trato que el resto de los errores de este formulario) para
    // poder mostrar el mensaje y que la persona lo corrija antes de crear la
    // cuenta — handle_new_user() igual degrada un valor malformado que
    // llegue por otra vía (ver la migración de unit 3), pero esta capa evita
    // que llegue por el propio formulario.
    const validGenreKeys = new Set((await listGenres()).map((genre) => genre.key))
    const taste = parseSignupTaste(
        { genres: formData.getAll('genres') as string[], birthYear: formData.get('birthYear') as string | null },
        validGenreKeys
    )
    if (taste.error) {
        return { error: taste.error }
    }

    // location/genres/birth_year viajan como user metadata, no como un UPDATE
    // aparte después del signUp: si el proyecto pide confirmar el email,
    // signUp() no deja sesión activa hasta que se confirma, y un UPDATE
    // corriendo sin sesión no pasa la policy "auth.uid() = id" — fallaría en
    // silencio en cualquier entorno con confirmación de email activada,
    // aunque funcione en local (acá está desactivada). El trigger
    // handle_new_user() corre SECURITY DEFINER y ya lee estos campos de acá
    // mismo.
    const metadata: Record<string, unknown> = {}
    if (location) metadata.location = location
    if (taste.genres && taste.genres.length > 0) metadata.genres = taste.genres
    if (taste.birthYear != null) metadata.birth_year = taste.birthYear

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`,
            ...(Object.keys(metadata).length > 0 ? { data: metadata } : {}),
        },
    })

    if (error) {
        // Never reveal whether an email is already registered — return the
        // exact same success response either way, so a caller can't enumerate
        // accounts by probing different emails.
        const msg = error.message.toLowerCase()
        if (msg.includes('already registered') || msg.includes('already exists')) {
            return { success: SIGNUP_SUCCESS_MESSAGE }
        }
        return { error: sanitizeAuthError(error) }
    }

    return { success: SIGNUP_SUCCESS_MESSAGE }
}

export async function signout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    redirect('/login')
}

export async function requestPasswordReset(prevState: AuthActionState, formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    if (!email) {
        return { error: 'El email es obligatorio.' }
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback?next=${routes.resetPassword}`,
    })

    if (error) {
        return { error: sanitizeAuthError(error) }
    }

    return { success: RESET_REQUEST_SUCCESS_MESSAGE }
}

export async function updatePassword(prevState: AuthActionState, formData: FormData) {
    const supabase = await createClient()

    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (!password || !confirmPassword) {
        return { error: 'Completá todos los campos.' }
    }

    if (password !== confirmPassword) {
        return { error: 'Las contraseñas no coinciden.' }
    }

    if (password.length < 6) {
        return { error: 'La contraseña debe tener al menos 6 caracteres.' }
    }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
        return { error: sanitizeAuthError(error) }
    }

    return { success: 'Tu contraseña fue actualizada correctamente. Ya podés ingresar.' }
}
