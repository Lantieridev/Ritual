import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { LoginForm } from '@/src/domains/auth/components'

export default async function LoginPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
        redirect('/')
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-ritual-bg px-6 py-24">
            <div className="w-full max-w-sm">
                <div className="border border-ritual-border bg-ritual-panel-2 p-8 border-b-[3px] border-b-ritual-red">
                    <p className="font-label text-[9px] tracking-[0.3em] uppercase text-ritual-red mb-1">Entrada válida</p>
                    <h1 className="font-display text-4xl uppercase text-ritual-bone mb-6">Ingresar</h1>
                    <LoginForm />
                </div>
                <div className="border-t border-dashed border-ritual-border mt-0" />
            </div>
        </main>
    )
}
