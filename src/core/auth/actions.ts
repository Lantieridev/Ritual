'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { getDevUserId } from '@/src/core/lib/env'
import { routes } from '@/src/core/lib/routes'

export async function login(prevState: any, formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/', 'layout')
    redirect(routes.home)
}

export async function signup(prevState: any, formData: FormData) {
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
        return { error: error.message }
    }

    // Check if email confirmation is required (depends on project settings)
    // For local dev, it might auto-confirm if email confirmations off.

    return { success: 'Check email to confirm account' }
}

export async function signout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    redirect('/login')
}

export async function claimLegacyData() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'No user logged in' }

    const oldUserId = getDevUserId()
    const newUserId = user.id

    if (!oldUserId) {
        return { error: 'DEV_USER_ID no configurado en .env.local' }
    }

    try {
        console.log(`Migrating data from ${oldUserId} to ${newUserId}...`)

        const updates = [
            supabase.from('attendance').update({ user_id: newUserId }).eq('user_id', oldUserId),
            supabase.from('memories').update({ user_id: newUserId }).eq('user_id', oldUserId),
            supabase.from('wishlist').update({ user_id: newUserId }).eq('user_id', oldUserId),
            supabase.from('expenses').update({ user_id: newUserId }).eq('user_id', oldUserId),
            supabase.from('festival_attendance').update({ user_id: newUserId }).eq('user_id', oldUserId),
        ]

        const results = await Promise.all(updates)

        const errors = results.filter(r => r.error).map(r => r.error?.message)

        if (errors.length > 0) {
            console.error('Migration errors:', errors)
            return { error: `Error parcial: ${errors.join(', ')}` }
        }

        return { success: true }
    } catch (e) {
        console.error('Migration failed:', e)
        return { error: 'Migration failed due to unexpected error.' }
    }
}
