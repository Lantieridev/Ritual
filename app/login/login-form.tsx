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
            className="w-full rounded-md bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-zinc-200 disabled:opacity-50"
        >
            {pending ? 'Ingresando...' : 'Ingresar'}
        </button>
    )
}

export function LoginForm() {
    const [state, action] = useActionState(login, null)

    return (
        <form action={action} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-backwards">
            <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500" htmlFor="email">
                    Email
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                    placeholder="tu@email.com"
                />
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500" htmlFor="password">
                    Contraseña
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                    placeholder="••••••••"
                />
            </div>

            {state?.error && (
                <p className="text-sm text-red-500 bg-red-500/10 p-2 rounded-md border border-red-500/20">
                    {state.error}
                </p>
            )}

            <SubmitButton />

            <div className="text-center text-sm text-zinc-500 pt-4">
                ¿No tenés cuenta?{' '}
                <Link href="/signup" className="text-white hover:underline underline-offset-4">
                    Registrate
                </Link>
            </div>
        </form>
    )
}
