import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { SignOutButton } from './sign-out-button'
import { getProfile } from '@/src/domains/auth/profile-actions'
import Link from 'next/link'
import { Button } from '@/src/core/components/ui/Button'
// import Image from 'next/image' // Use img for now to avoid domain config issues with Supabase Storage

export const metadata = {
    title: 'Mi Perfil | RITUAL',
}

export default async function ProfilePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const profile = await getProfile(user.id)

    return (
        <main className="min-h-screen bg-neutral-950 text-white font-sans pt-24 px-6 md:px-8">
            <div className="max-w-2xl mx-auto space-y-8">

                {/* Header with Sign Out */}
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">Mi Perfil</h1>
                    <SignOutButton />
                </div>

                <hr className="border-white/10" />

                {/* Profile Card */}
                <section className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Avatar */}
                    <div className="shrink-0">
                        <div className="w-32 h-32 rounded-full overflow-hidden bg-neutral-900 border border-white/10 relative">
                            {profile?.avatar_url ? (
                                <img
                                    src={profile.avatar_url}
                                    alt={profile.full_name || 'Avatar'}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl text-zinc-700 font-bold select-none">
                                    {(profile?.full_name?.[0] || user.email?.[0] || '?').toUpperCase()}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 space-y-4">
                        <div>
                            <h2 className="text-2xl font-bold">{profile?.full_name || 'Sin nombre'}</h2>
                            <p className="text-zinc-400">@{profile?.username || 'usuario'}</p>
                        </div>

                        {profile?.bio && (
                            <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                {profile.bio}
                            </p>
                        )}

                        <div className="flex flex-wrap gap-4 pt-2">
                            {profile?.location && (
                                <div className="text-sm text-zinc-500 flex items-center gap-2">
                                    📍 {profile.location}
                                </div>
                            )}
                            {profile?.website && (
                                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline flex items-center gap-2">
                                    🔗 {profile.website.replace(/^https?:\/\//, '')}
                                </a>
                            )}
                        </div>

                        <div className="pt-4">
                            <Link href="/profile/edit">
                                <Button variant="secondary" className="w-full md:w-auto">
                                    Editar Perfil
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>

                <hr className="border-white/10" />

                {/* Account Settings Placeholder */}
                <section className="space-y-6">
                    <h3 className="text-lg font-semibold text-zinc-400">Cuenta</h3>
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                        <p className="text-sm text-zinc-400">Correo electrónico</p>
                        <p className="text-white mt-1">{user.email}</p>
                    </div>
                </section>

            </div>
        </main>
    )
}
