'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import type { VenueTipCategory } from '@/src/domains/venues/service'

const AddVenueTipMutation = gql`
  mutation AddVenueTip($venueId: ID!, $body: String!, $category: String!) {
    addVenueTip(venueId: $venueId, body: $body, category: $category) { error }
  }
`

const CATEGORY_LABELS: Record<VenueTipCategory, string> = {
    estacionamiento: 'Estacionamiento',
    cola: 'Cola / entrada',
    que_llevar: 'Qué llevar',
    otro: 'Otro',
}

const MAX_BODY = 500

interface AddVenueTipFormProps {
    venueId: string
}

/**
 * router.refresh() en vez de actualizar un estado local con el tip nuevo:
 * la lista de tips la arma el Server Component de la página (agrupada,
 * ordenada), y duplicar esa forma acá adentro sería la misma lógica en dos
 * lugares. El costo es un round-trip extra al servidor, aceptable para un
 * formulario que no se envía seguido.
 */
export function AddVenueTipForm({ venueId }: AddVenueTipFormProps) {
    const router = useRouter()
    const [, addVenueTip] = useMutation(AddVenueTipMutation)
    const [category, setCategory] = useState<VenueTipCategory>('otro')
    const [body, setBody] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isPending, setIsPending] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (isPending) return
        const trimmed = body.trim()
        if (!trimmed) {
            setError('Escribí algo antes de publicar.')
            return
        }

        setIsPending(true)
        setError(null)
        const result = await addVenueTip({ venueId, body: trimmed, category })
        const { error: mutError } = unwrapMutation(result, 'addVenueTip')
        setIsPending(false)

        if (mutError) {
            setError(mutError)
            return
        }
        setBody('')
        router.refresh()
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {(Object.keys(CATEGORY_LABELS) as VenueTipCategory[]).map((c) => (
                    <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={`px-3 py-1.5 font-label text-[10px] tracking-[0.1em] uppercase transition-colors ${category === c
                            ? 'bg-ritual-surface-high text-ritual-bone'
                            : 'text-ritual-gray-text hover:text-ritual-bone hover:bg-ritual-surface border border-ritual-border'
                            }`}
                    >
                        {CATEGORY_LABELS[c]}
                    </button>
                ))}
            </div>

            <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
                placeholder="Ej. Hay estacionamiento gratis a dos cuadras, sobre la calle Corrientes."
                rows={3}
                disabled={isPending}
                className="w-full border border-ritual-border bg-ritual-surface px-4 py-3 font-body text-sm text-ritual-bone placeholder-ritual-gray-mid focus:border-ritual-red focus:outline-none focus:ring-1 focus:ring-ritual-red/40 resize-none disabled:opacity-50"
            />
            <div className="flex items-center justify-between gap-3">
                <p className="font-label text-[10px] text-ritual-gray-text">{body.length}/{MAX_BODY}</p>
                <button
                    type="submit"
                    disabled={isPending}
                    className="ritual-cta bg-ritual-red text-ritual-bone px-5 py-2 font-label text-[10px] tracking-[0.14em] uppercase disabled:opacity-50"
                >
                    {isPending ? 'Publicando…' : 'Publicar tip'}
                </button>
            </div>
            {error && (
                <p role="alert" className="font-label text-xs text-ritual-red-hover">
                    {error}
                </p>
            )}
        </form>
    )
}
