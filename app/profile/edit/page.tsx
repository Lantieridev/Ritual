import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { findProfile } from '@/src/domains/auth/service'
import { ProfileForm } from '@/src/domains/auth/components'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'

export const metadata = {
    title: 'Editar Perfil | RITUAL',
}

export default async function EditProfilePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const profile = await findProfile(user.id)

    return (
        <PageShell
            backHref={routes.profile}
            backLabel="← Volver al perfil"
            title="Editar Perfil"
            description="Actualiza tu información pública."
        >
            <div className="max-w-2xl mx-auto space-y-8">
                <hr className="border-white/10" />
                <ProfileForm user={{ id: user.id, email: user.email }} profile={profile} />
            </div>
        </PageShell>
    )
}
