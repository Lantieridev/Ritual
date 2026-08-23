'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, gql } from 'urql'
import { FormField } from '@/src/core/components/ui'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'

const CreateFestivalMutation = gql`
  mutation CreateFestival($input: FestivalCreateInput!) {
    createFestival(input: $input) { id error }
  }
`

export default function NuevoFestivalPage() {
    const router = useRouter()
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [, createFestival] = useMutation(CreateFestivalMutation)

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError(null)
        const formData = new FormData(e.currentTarget)

        startTransition(async () => {
            const { data } = await createFestival({
                input: {
                    name: formData.get('name') as string,
                    edition: formData.get('edition') as string,
                    startDate: formData.get('start_date') as string,
                    endDate: (formData.get('end_date') as string) || undefined,
                    city: formData.get('city') as string,
                    country: formData.get('country') as string,
                    website: formData.get('website') as string,
                    notes: formData.get('notes') as string,
                },
            })
            const result = data?.createFestival
            if (!result || result.error || !result.id) {
                setError(result?.error ?? 'No se pudo crear el festival.')
                return
            }
            router.push(routes.festivals.detail(result.id))
        })
    }

    return (
        <PageShell
            backHref={routes.festivals.list}
            backLabel="← Volver a festivales"
            title="Nuevo festival"
            description="Registrá un festival de música."
        >
            <div className="max-w-xl">
                <form onSubmit={handleSubmit} className="space-y-5">
                    <FormField label="Nombre del festival *" id="name">
                        <input
                            type="text"
                            id="name"
                            name="name"
                            required
                            placeholder="ej. Lollapalooza Argentina"
                            className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                    </FormField>

                    <FormField label="Edición" id="edition">
                        <input
                            type="text"
                            id="edition"
                            name="edition"
                            placeholder="ej. 2024, Edición 10"
                            className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                    </FormField>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Fecha de inicio *" id="start_date">
                            <input
                                type="date"
                                id="start_date"
                                name="start_date"
                                required
                                className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
                            />
                        </FormField>
                        <FormField label="Fecha de fin" id="end_date">
                            <input
                                type="date"
                                id="end_date"
                                name="end_date"
                                className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
                            />
                        </FormField>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Ciudad" id="city">
                            <input
                                type="text"
                                id="city"
                                name="city"
                                placeholder="ej. Buenos Aires"
                                className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
                            />
                        </FormField>
                        <FormField label="País" id="country">
                            <input
                                type="text"
                                id="country"
                                name="country"
                                placeholder="ej. Argentina"
                                className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
                            />
                        </FormField>
                    </div>

                    <FormField label="Sitio web" id="website">
                        <input
                            type="url"
                            id="website"
                            name="website"
                            placeholder="https://..."
                            className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                    </FormField>

                    <FormField label="Notas" id="notes">
                        <textarea
                            id="notes"
                            name="notes"
                            rows={3}
                            placeholder="Artistas que querés ver, días que vas, etc."
                            className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                        />
                    </FormField>

                    {error && (
                        <div className="rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-zinc-100 transition-colors disabled:opacity-50"
                        >
                            {isPending ? 'Guardando…' : 'Crear festival'}
                        </button>
                        <Link
                            href={routes.festivals.list}
                            className="inline-flex items-center justify-center rounded-lg border border-white/15 px-6 py-2.5 text-sm font-medium text-zinc-400 hover:text-white hover:border-white/30 transition-colors"
                        >
                            Cancelar
                        </Link>
                    </div>
                </form>
            </div>
        </PageShell>
    )
}
