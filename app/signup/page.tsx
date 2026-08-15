import { redirect } from 'next/navigation'
import { gql } from 'urql'
import { createClient } from '@/src/core/lib/supabase/server'
import { getClient } from '@/src/graphql/client'
import { SignupForm } from '@/src/domains/auth/components'
import type { GenreOption } from '@/src/domains/taste/data'

const SignupPageQuery = gql`
    query SignupPage {
        genres { key label }
    }
`

export default async function SignupPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
        redirect('/')
    }

    const { data } = await getClient().query<{ genres: GenreOption[] }>(SignupPageQuery, {}).toPromise()
    const genres = data?.genres ?? []

    return (
        <main className="min-h-screen flex items-center justify-center bg-ritual-bg px-6 py-24">
            <div className="w-full max-w-sm">
                <div className="border border-ritual-border bg-ritual-panel-2 p-8 border-b-[3px] border-b-ritual-red">
                    <p className="font-label text-[9px] tracking-[0.3em] uppercase text-ritual-red-hover mb-1">Talón sin numerar</p>
                    <h1 className="font-display text-4xl uppercase text-ritual-bone mb-6">Crear cuenta</h1>
                    <SignupForm genres={genres} />
                </div>
                <div className="border-t border-dashed border-ritual-border mt-0" />
            </div>
        </main>
    )
}
