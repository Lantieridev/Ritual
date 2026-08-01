'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { signup } from '@/src/core/auth/actions'

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full bg-ritual-red px-4 py-3 font-figure text-xl tracking-wide text-ritual-panel transition-colors hover:bg-ritual-red-hover disabled:opacity-50"
        >
            {pending ? 'Emitiendo…' : 'Emitir mi talonario'}
        </button>
    )
}

export function SignupForm() {
    const [state, action] = useActionState(signup, null)

    if (state?.success) {
        return (
            <div className="border border-ritual-border bg-ritual-surface p-6 text-center">
                <h3 className="font-display text-2xl uppercase text-ritual-bone mb-2">Talonario emitido</h3>
                <p className="font-body text-sm text-ritual-gray-text mb-4">
                    Te enviamos un email de confirmación (si aplica) o ya podés ingresar.
                </p>
                <Link
                    href="/login"
                    className="inline-block bg-ritual-red px-5 py-2.5 font-label text-[10px] tracking-[0.14em] uppercase text-ritual-panel hover:bg-ritual-red-hover"
                >
                    Ir a Ingresar
                </Link>
            </div>
        )
    }

    return (
        <form action={action} className="space-y-5">
            <div className="space-y-1.5">
                <label className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-mid" htmlFor="email">
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

            <div className="space-y-1.5">
                <label className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-mid" htmlFor="password">
                    Contraseña
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

            {state?.error && (
                <p role="alert" className="font-body text-sm text-ritual-red bg-ritual-red/10 border border-ritual-red/20 p-3">
                    {state.error}
                </p>
            )}

            <SubmitButton />

            <div className="text-center font-label text-xs text-ritual-gray-mid pt-4">
                ¿Ya tenés talonario?{' '}
                <Link href="/login" className="text-ritual-red hover:underline underline-offset-4">
                    Ingresá
                </Link>
            </div>
        </form>
    )
}
