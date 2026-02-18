'use client'

import { useState } from 'react'
import { login, signup } from '@/src/domains/auth/actions'
import { PageShell } from '@/src/core/components/layout'

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError(null)
        setLoading(true)

        const formData = new FormData(e.currentTarget)
        const result = isLogin ? await login(formData) : await signup(formData)

        if (result?.error) {
            setError(result.error)
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold tracking-tighter text-white">RITUAL</h1>
                    <p className="text-zinc-500 mt-2 text-sm uppercase tracking-widest">
                        {isLogin ? 'Inicia sesión' : 'Crea tu cuenta'}
                    </p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-zinc-400 uppercase ml-1" htmlFor="fullName">
                                    Nombre Completo
                                </label>
                                <input
                                    id="fullName"
                                    name="fullName"
                                    type="text"
                                    required
                                    placeholder="Tu nombre"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:border-white/30 focus:outline-none transition-all"
                                />
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-400 uppercase ml-1" htmlFor="email">
                                Email
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                placeholder="hola@ejemplo.com"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:border-white/30 focus:outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-400 uppercase ml-1" htmlFor="password">
                                Contraseña
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                placeholder="••••••••"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:border-white/30 focus:outline-none transition-all"
                            />
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-2 px-3 rounded-lg text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50 mt-2"
                        >
                            {loading ? 'Cargando...' : isLogin ? 'Entrar' : 'Registrarse'}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-white/5 text-center">
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-zinc-500 text-xs hover:text-white transition-colors"
                        >
                            {isLogin ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
                        </button>
                    </div>
                </div>

                <p className="text-center text-zinc-700 text-[10px] mt-8 uppercase tracking-widest">
                    Ritual © 2026 — Records of Concerts
                </p>
            </div>
        </div>
    )
}
