import { createClient } from '@/src/core/lib/supabase-server'

export async function getCurrentUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

export async function getCurrentUserId() {
    const user = await getCurrentUser()
    return user?.id
}

export async function getProfile(userId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

    if (error) return null
    return data
}
