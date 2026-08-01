'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { login } from '@/src/core/auth/actions'

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full bg-ritual-red px-4 py-3 font-figure text-xl tracking-wide text-ritual-panel transition-colors hover:bg-ritual-red-hover disabled:opacity-50"
        >
            {pending ? 'Cortando…' : 'Cortar y entrar'}
        </button>
    )
}

export function LoginForm() {
    const [state, action] = useActionState(login, null)

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
                    autoComplete="current-password"
                    className="w-full border-0 border-b border-ritual-border bg-transparent px-0 py-2 font-figure text-xl text-ritual-bone placeholder-ritual-gray-mid focus:border-ritual-red focus:outline-none"
                    placeholder="••••••••"
                />
            </div>

            {state?.error && (
                <p role="alert" className="font-body text-sm text-ritual-red bg-ritual-red/10 border border-ritual-red/20 p-3">
                    {state.error}
                </p>
            )}

            <SubmitButton />

            <div className="text-center font-label text-xs text-ritual-gray-mid pt-4">
                ¿No tenés talonario?{' '}
                <Link href="/signup" className="text-ritual-red hover:underline underline-offset-4">
                    Emitilo acá
                </Link>
            </div>
        </form>
    )
}
