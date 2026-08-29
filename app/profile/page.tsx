import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { SignOutButton } from '@/src/domains/auth/components'
import { findProfile } from '@/src/domains/auth/service'
import { listMyEvents } from '@/src/domains/events/service'
import { safeHref } from '@/src/core/lib/validation'
import { routes } from '@/src/core/lib/routes'
import { LinkButton } from '@/src/core/components/ui'
import { PageShell } from '@/src/core/components/layout'

export const metadata = {
    title: 'Mi Perfil | RITUAL',
}

function monogram(name: string | null | undefined, fallback: string): string {
    const source = name?.trim() || fallback
    const parts = source.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return source.slice(0, 2).toUpperCase()
}

export default async function ProfilePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const [profile, myEvents] = await Promise.all([
        findProfile(user.id),
        listMyEvents(),
    ])

    // Sólo el conteo para el sello del carnet — la lista completa (con orden,
    // agrupamiento por año y filtro Todos/Próximos/Vividos) vive en /agenda,
    // issue #65. listMyEvents ya trae nada más que attendance propia (no el
    // catálogo entero), así que este conteo no dispara una consulta extra.
    const wentCount = myEvents.filter((e) => e.attendance?.[0]?.status === 'went').length

    const displayName = profile?.full_name || user.email?.split('@')[0] || 'Sin nombre'
    const seal = monogram(profile?.full_name, user.email?.[0] ?? '?')

    return (
        <PageShell title="Mi Perfil" action={<SignOutButton />}>
            <div className="max-w-3xl mx-auto space-y-12">
                {/* El carnet de socio: sello · datos · social */}
                <section className="border border-ritual-border bg-ritual-surface p-6 md:p-8">
                    <div className="grid md:grid-cols-[auto_1fr_auto] gap-6 md:gap-10 items-start">
                        {/* Sello */}
                        <div className="w-24 h-24 shrink-0 border-2 border-ritual-red flex items-center justify-center mx-auto md:mx-0">
                            <span className="font-display text-4xl text-ritual-red-hover">{seal}</span>
                        </div>

                        {/* Datos */}
                        <div className="text-center md:text-left">
                            <p className="font-label text-[9px] tracking-[0.2em] uppercase text-ritual-gray-text">Socio Ritual</p>
                            <h2 className="font-display text-3xl uppercase text-ritual-bone mt-1">{displayName}</h2>
                            <p className="font-label text-xs text-ritual-gray-text">@{profile?.username || 'usuario'}</p>
                            {profile?.bio && <p className="font-body text-sm text-ritual-gray-light-3 mt-3 whitespace-pre-wrap">{profile.bio}</p>}
                            <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4 font-label text-xs text-ritual-gray-text">
                                {profile?.location && <span>📍 {profile.location}</span>}
                                {safeHref(profile?.website) && (
                                    <a href={safeHref(profile?.website)!} target="_blank" rel="noopener noreferrer" className="text-ritual-red-hover hover:underline">
                                        {profile!.website!.replace(/^https?:\/\//, '')}
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Cifras */}
                        <div className="flex md:flex-col gap-6 md:gap-2 justify-center font-figure text-2xl text-ritual-bone text-center md:text-right shrink-0">
                            <div>
                                {wentCount}
                                <p className="font-label text-[9px] tracking-[0.14em] uppercase text-ritual-gray-text mt-0.5">shows</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-ritual-border-subtle flex flex-wrap gap-3">
                        <LinkButton href={routes.agenda} className="px-5 py-2">
                            Ver mi agenda
                        </LinkButton>
                        {/* Los logros en sí (issue #61) viven en /stats, calculados junto
                            al resto de las estadísticas — evita duplicar el fetch acá. */}
                        <LinkButton href={routes.stats} variant="secondary" className="px-5 py-2">
                            Ver mis logros
                        </LinkButton>
                        <LinkButton href={routes.profile + '/edit'} variant="secondary" className="px-5 py-2">
                            Editar carnet
                        </LinkButton>
                        {/* Ventana y plantilla del checklist pre-show — issue #9 */}
                        <LinkButton href={routes.showMode} variant="secondary" className="px-5 py-2">
                            Modo recital
                        </LinkButton>
                    </div>
                </section>

                {/* Cuenta */}
                <section>
                    <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-3">Cuenta</h2>
                    <div className="border border-ritual-border-subtle bg-ritual-surface p-4">
                        <p className="font-label text-[9px] tracking-[0.14em] uppercase text-ritual-gray-text">Correo electrónico</p>
                        <p className="font-body text-ritual-bone mt-1">{user.email}</p>
                    </div>
                </section>
            </div>
        </PageShell>
    )
}
