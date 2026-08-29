import { createClient } from '@/src/core/lib/supabase/server'
import { Profile } from '@/src/core/types'

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

/**
 * Usernames de varios usuarios, por id — para el DataLoader de
 * `Expense.ownerUsername` (issue #58): un gasto compartido necesita mostrar
 * quién lo pagó, no sólo quién está tageado en el split.
 */
export async function getUsernamesByIdsBatch(userIds: readonly string[]): Promise<Array<string | null>> {
    if (userIds.length === 0) return []
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds as string[])

    if (error) {
        console.error('Error cargando usernames:', error)
        return userIds.map(() => null)
    }

    const usernameById = new Map((data ?? []).map((p) => [p.id, p.username as string | null]))
    return userIds.map((id) => usernameById.get(id) ?? null)
}
