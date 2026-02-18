import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { SignupForm } from './signup-form'

export default async function SignupPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
        redirect('/')
    }

    return (
        <main className="min-h-screen grid lg:grid-cols-2">
            {/* Visual Side */}
            <div className="hidden lg:block relative bg-neutral-900 overflow-hidden order-last">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay" />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent" />

                <div className="absolute bottom-20 right-20 p-8 border-r border-white/20 backdrop-blur-sm bg-black/20 text-white max-w-md text-right">
                    <p className="font-mono text-xs mb-4 text-emerald-500 tracking-widest uppercase">
                        NUEVO USUARIO
                    </p>
                    <blockquote className="text-xl font-light leading-relaxed mb-6">
                        &quot;Cada entrada es una historia que merece ser contada.&quot;
                    </blockquote>
                    <p className="text-sm text-zinc-400">Empezá tu colección hoy.</p>
                </div>
            </div>

            {/* Form Side */}
            <div className="bg-neutral-950 flex flex-col items-center justify-center p-8 text-white relative">
                <div className="absolute top-8 left-8">
                    <span className="font-bold tracking-tighter text-2xl">RITUAL</span>
                </div>

                <div className="w-full max-w-sm space-y-8">
                    <div className="space-y-2 text-center lg:text-left">
                        <h1 className="text-3xl font-bold tracking-tight">Crear Cuenta</h1>
                        <p className="text-zinc-400">
                            Unite para guardar tus recitales.
                        </p>
                    </div>

                    <SignupForm />
                </div>
            </div>
        </main>
    )
}
