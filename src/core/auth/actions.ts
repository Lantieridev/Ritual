'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { routes } from '@/src/core/lib/routes'
import { sanitizeAuthError } from '@/src/core/lib/validation'

type AuthActionState = { error: string } | { success: string } | null

const SIGNUP_SUCCESS_MESSAGE = 'Revisá tu email para confirmar la cuenta.'

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

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`,
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
