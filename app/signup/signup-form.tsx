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
            className="w-full rounded-md bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-zinc-200 disabled:opacity-50"
        >
            {pending ? 'Creando cuenta...' : 'Registrarse'}
        </button>
    )
}

export function SignupForm() {
    const [state, action] = useActionState(signup, null)

    if (state?.success) {
        return (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
                <h3 className="text-lg font-semibold text-emerald-400 mb-2">¡Cuenta creada!</h3>
                <p className="text-sm text-zinc-300 mb-4">
                    Te enviamos un email de confirmación (si aplica) o ya podés ingresar.
                </p>
                <Link
                    href="/login"
                    className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                    Ir al Login
                </Link>
            </div>
        )
    }

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
                    minLength={6}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                    placeholder="Mínimo 6 caracteres"
                />
            </div>

            {state?.error && (
                <p className="text-sm text-red-500 bg-red-500/10 p-2 rounded-md border border-red-500/20">
                    {state.error}
                </p>
            )}

            <SubmitButton />

            <div className="text-center text-sm text-zinc-500 pt-4">
                ¿Ya tenés cuenta?{' '}
                <Link href="/login" className="text-white hover:underline underline-offset-4">
                    Ingresá
                </Link>
            </div>
        </form>
    )
}
