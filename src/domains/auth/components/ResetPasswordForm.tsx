'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { updatePassword } from '@/src/core/auth/actions'
import { routes } from '@/src/core/lib/routes'

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full bg-ritual-red px-4 py-3 font-figure text-xl tracking-wide text-ritual-bone transition-colors hover:bg-ritual-red-hover disabled:opacity-50"
        >
            {pending ? 'Actualizando…' : 'Guardar nueva contraseña'}
        </button>
    )
}

export function ResetPasswordForm() {
    const [state, action] = useActionState(updatePassword, null)

    if (state?.success) {
        return (
            <div className="border border-ritual-border bg-ritual-surface p-6 text-center space-y-4">
                <h3 className="font-display text-2xl uppercase text-ritual-bone">Contraseña actualizada</h3>
                <p className="font-body text-sm text-ritual-gray-text">
                    {state.success}
                </p>
                <Link
                    href={routes.login}
                    className="inline-block bg-ritual-red px-5 py-2.5 font-label text-[10px] tracking-[0.14em] uppercase text-ritual-bone hover:bg-ritual-red-hover"
                >
                    Ir a Ingresar
                </Link>
            </div>
        )
    }

    return (
        <form action={action} className="space-y-5">
            <div className="space-y-1.5">
                <label className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text" htmlFor="password">
                    Nueva contraseña
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full border-0 border-b border-ritual-border bg-transparent px-0 py-2 font-figure text-xl text-ritual-bone placeholder-ritual-gray-mid focus:border-ritual-red focus:outline-none"
                    placeholder="Mínimo 6 caracteres"
                />
            </div>

            <div className="space-y-1.5">
                <label className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text" htmlFor="confirmPassword">
                    Confirmar contraseña
                </label>
                <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full border-0 border-b border-ritual-border bg-transparent px-0 py-2 font-figure text-xl text-ritual-bone placeholder-ritual-gray-mid focus:border-ritual-red focus:outline-none"
                    placeholder="Repetir contraseña"
                />
            </div>

            {state?.error && (
                <p role="alert" className="font-body text-sm text-ritual-red-hover bg-ritual-red/10 border border-ritual-red/20 p-3">
                    {state.error}
                </p>
            )}

            <SubmitButton />

            <div className="text-center font-label text-xs text-ritual-gray-text pt-4">
                <Link href={routes.login} className="text-ritual-red-hover hover:underline underline-offset-4">
                    Volver a Ingresar
                </Link>
            </div>
        </form>
    )
}
