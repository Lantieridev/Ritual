import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { getProfile } from '@/src/domains/auth/profile-actions'
import { ProfileForm } from './profile-form'

export const metadata = {
    title: 'Editar Perfil | RITUAL',
}

export default async function EditProfilePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const profile = await getProfile(user.id)

    return (
        <main className="min-h-screen bg-neutral-950 text-white font-sans pt-24 px-6 md:px-8">
            <div className="max-w-2xl mx-auto space-y-8">

                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">Editar Perfil</h1>
                    <p className="text-zinc-400">Actualiza tu información pública.</p>
                </div>

                <hr className="border-white/10" />

                <ProfileForm user={{ id: user.id, email: user.email }} profile={profile} />

            </div>
        </main>
    )
}
