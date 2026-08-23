import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/core/lib/supabase/server'
import { SignOutButton } from '@/src/domains/auth/components'
import { getProfile } from '@/src/domains/auth/data'
import { getEventsWithAttendance } from '@/src/domains/events/data'
import { safeHref } from '@/src/core/lib/validation'
import { formatDate } from '@/src/core/lib/utils'
import { routes } from '@/src/core/lib/routes'
import { StarRating, LinkButton } from '@/src/core/components/ui'
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

    const [profile, allEvents] = await Promise.all([
        getProfile(user.id),
        getEventsWithAttendance(),
    ])

    const wentEvents = allEvents
        .filter((e) => e.attendance?.[0]?.status === 'went')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

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
                                {wentEvents.length}
                                <p className="font-label text-[9px] tracking-[0.14em] uppercase text-ritual-gray-text mt-0.5">shows</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-ritual-border-subtle flex flex-wrap gap-3">
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

                {/* La base de datos de tus shows */}
                {wentEvents.length > 0 && (
                    <section>
                        <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">
                            Tu base de datos — {wentEvents.length} shows
                        </h2>
                        <ul className="divide-y divide-ritual-border-subtle">
                            {wentEvents.map((ev) => {
                                const rating = ev.attendance?.[0]?.rating
                                const review = ev.attendance?.[0]?.review
                                return (
                                    <li key={ev.id} className="py-4">
                                        <Link href={routes.events.detail(ev.id)} className="flex items-start gap-4 group">
                                            <div className="w-12 shrink-0 text-center">
                                                <p className="font-label text-[9px] font-bold text-ritual-gray-text uppercase">{formatDate(ev.date, { month: 'short' })}</p>
                                                <p className="font-display text-xl text-ritual-bone leading-none">{new Date(ev.date).getDate()}</p>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-dense font-extrabold text-ritual-bone truncate">{ev.name || ev.lineups?.[0]?.artists.name || 'Recital'}</p>
                                                {ev.venues && <p className="font-label text-[10px] text-ritual-gray-text">{ev.venues.name}</p>}
                                                {review && <p className="font-body italic text-sm text-ritual-gray-light-3 mt-1.5">&ldquo;{review}&rdquo;</p>}
                                            </div>
                                            {rating != null && <StarRating value={rating} size="xs" className="shrink-0" />}
                                        </Link>
                                    </li>
                                )
                            })}
                        </ul>
                    </section>
                )}
            </div>
        </PageShell>
    )
}
