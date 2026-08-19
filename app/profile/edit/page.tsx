import { redirect } from 'next/navigation'
import { gql } from 'urql'
import { createClient } from '@/src/core/lib/supabase/server'
import { getClient } from '@/src/graphql/client'
import { findProfile } from '@/src/domains/auth/service'
import { findTasteProfile } from '@/src/domains/taste/service'
import { ProfileForm } from '@/src/domains/auth/components'
import { TasteProfileForm, LastfmConnect } from '@/src/domains/taste/components'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'
import type { GenreOption } from '@/src/domains/taste/data'

export const metadata = {
    title: 'Editar Perfil | RITUAL',
}

const EditProfilePageQuery = gql`
    query EditProfilePage {
        genres { key label }
    }
`

export default async function EditProfilePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const profile = await findProfile(user.id)
    const tasteProfile = await findTasteProfile(user.id)
    const { data } = await getClient().query<{ genres: GenreOption[] }>(EditProfilePageQuery, {}).toPromise()
    const genres = data?.genres ?? []

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

                <hr className="border-white/10" />
                <section className="space-y-4">
                    <h2 className="font-display text-xl uppercase text-ritual-bone">Gustos musicales</h2>
                    <TasteProfileForm
                        genres={genres}
                        defaultGenres={tasteProfile?.genres}
                        defaultBirthYear={tasteProfile?.birthYear ?? null}
                    />
                </section>

                <hr className="border-white/10" />
                <section className="space-y-4">
                    <h2 className="font-display text-xl uppercase text-ritual-bone">Last.fm</h2>
                    <LastfmConnect lastfmUsername={tasteProfile?.lastfmUsername ?? null} />
                </section>
            </div>
        </PageShell>
    )
}
