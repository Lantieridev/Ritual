'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { requestPasswordReset } from '@/src/core/auth/actions'
import { routes } from '@/src/core/lib/routes'

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full bg-ritual-red px-4 py-3 font-figure text-xl tracking-wide text-ritual-bone transition-colors hover:bg-ritual-red-hover disabled:opacity-50"
        >
            {pending ? 'Enviando…' : 'Enviar instrucciones'}
        </button>
    )
}

export function ForgotPasswordForm() {
    const [state, action] = useActionState(requestPasswordReset, null)

    if (state?.success) {
        return (
            <div className="border border-ritual-border bg-ritual-surface p-6 text-center space-y-4">
                <h3 className="font-display text-2xl uppercase text-ritual-bone">Solicitud enviada</h3>
                <p className="font-body text-sm text-ritual-gray-text">
                    {state.success}
                </p>
                <Link
                    href={routes.login}
                    className="inline-block bg-ritual-red px-5 py-2.5 font-label text-[10px] tracking-[0.14em] uppercase text-ritual-bone hover:bg-ritual-red-hover"
                >
                    Volver a Ingresar
                </Link>
            </div>
        )
    }

    return (
        <form action={action} className="space-y-5">
            <p className="font-body text-sm text-ritual-gray-text mb-4">
                Ingresá tu email registrado y te enviaremos un enlace para restablecer tu contraseña.
            </p>

            <div className="space-y-1.5">
                <label className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text" htmlFor="email">
                    Email
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="w-full border-0 border-b border-ritual-border bg-transparent px-0 py-2 font-figure text-xl text-ritual-bone placeholder-ritual-gray-mid focus:border-ritual-red focus:outline-none"
                    placeholder="tu@email.com"
                />
            </div>

            {state?.error && (
                <p role="alert" className="font-body text-sm text-ritual-red-hover bg-ritual-red/10 border border-ritual-red/20 p-3">
                    {state.error}
                </p>
            )}

            <SubmitButton />

            <div className="text-center font-label text-xs text-ritual-gray-text pt-4">
                ¿Recordaste tu contraseña?{' '}
                <Link href={routes.login} className="text-ritual-red-hover hover:underline underline-offset-4">
                    Ingresá
                </Link>
            </div>
        </form>
    )
}
