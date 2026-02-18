import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { ClaimDataButton } from './claim-data-button'
import { SignOutButton } from './sign-out-button'

export const metadata = {
    title: 'Mi Perfil | RITUAL',
}

export default async function ProfilePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    return (
        <main className="min-h-screen bg-neutral-950 text-white font-sans pt-24 px-6 md:px-8">
            <div className="max-w-2xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Mi Perfil</h1>
                        <p className="text-zinc-400 mt-1">{user.email}</p>
                    </div>
                    <SignOutButton />
                </div>

                <hr className="border-white/10" />

                {/* Account Actions */}
                <section className="space-y-6">
                    <h2 className="text-xl font-semibold">Configuración</h2>

                    <ClaimDataButton />

                    <div className="rounded-xl border border-white/10 p-6">
                        <p className="text-zinc-500 text-sm">
                            Próximamente podrás cambiar tu contraseña y editar tu perfil público.
                        </p>
                    </div>
                </section>
            </div>
        </main>
    )
}
