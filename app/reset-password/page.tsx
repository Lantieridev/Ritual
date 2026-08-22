import Link from 'next/link'
import { createClient } from '@/src/core/lib/supabase/server'
import { ResetPasswordForm } from '@/src/domains/auth/components'
import { routes } from '@/src/core/lib/routes'

export default async function ResetPasswordPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-ritual-bg px-6 py-24">
                <div className="w-full max-w-sm">
                    <div className="border border-ritual-border bg-ritual-panel-2 p-8 border-b-[3px] border-b-ritual-red">
                        <p className="font-label text-[9px] tracking-[0.3em] uppercase text-ritual-red-hover mb-1">Enlace inválido</p>
                        <h1 className="font-display text-3xl uppercase text-ritual-bone mb-4">Enlace vencido</h1>
                        <p className="font-body text-sm text-ritual-gray-text mb-6">
                            El enlace para restablecer tu contraseña es inválido o ya expiró. Por favor solicitá uno nuevo.
                        </p>
                        <Link
                            href={routes.forgotPassword}
                            className="block w-full text-center bg-ritual-red px-4 py-3 font-figure text-xl tracking-wide text-ritual-bone transition-colors hover:bg-ritual-red-hover"
                        >
                            Solicitar nuevo enlace
                        </Link>
                    </div>
                    <div className="border-t border-dashed border-ritual-border mt-0" />
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-ritual-bg px-6 py-24">
            <div className="w-full max-w-sm">
                <div className="border border-ritual-border bg-ritual-panel-2 p-8 border-b-[3px] border-b-ritual-red">
                    <p className="font-label text-[9px] tracking-[0.3em] uppercase text-ritual-red-hover mb-1">Cambio de acceso</p>
                    <h1 className="font-display text-4xl uppercase text-ritual-bone mb-6">Nueva clave</h1>
                    <ResetPasswordForm />
                </div>
                <div className="border-t border-dashed border-ritual-border mt-0" />
            </div>
        </main>
    )
}
