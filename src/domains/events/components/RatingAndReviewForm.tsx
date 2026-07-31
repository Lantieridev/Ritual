'use client'

import { useState, useTransition } from 'react'
import { saveMemory } from '@/src/domains/events/attendance-actions'
import { StarRating } from '@/src/core/components/ui'

interface RatingAndReviewFormProps {
    eventId: string
    initialRating?: number | null
    initialReview?: string | null
    initialNotes?: string | null
}

const MAX_REVIEW = 2000
const MAX_NOTES = 5000

export function RatingAndReviewForm({
    eventId,
    initialRating,
    initialReview,
    initialNotes,
}: RatingAndReviewFormProps) {
    const [rating, setRating] = useState<number>(initialRating ?? 0)
    const [review, setReview] = useState(initialReview ?? '')
    const [notes, setNotes] = useState(initialNotes ?? '')
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaved(false)
        setError(null)
        startTransition(async () => {
            const result = await saveMemory(eventId, {
                rating: rating > 0 ? rating : undefined,
                review: review.trim() || undefined,
                notes: notes.trim() || undefined,
            })
            if (result?.error) {
                setError(result.error)
            } else {
                setSaved(true)
            }
        })
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* Estrellas */}
            <div>
                <p className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-text mb-2">Tu rating</p>
                <div className="flex items-center gap-1">
                    <StarRating value={rating} onChange={setRating} size="2xl" ariaLabel="Rating del show" />
                    {rating > 0 && (
                        <button
                            type="button"
                            onClick={() => setRating(0)}
                            className="ml-2 font-label text-xs text-ritual-gray-mid hover:text-ritual-gray-text transition-colors self-center"
                        >
                            Borrar
                        </button>
                    )}
                </div>
            </div>

            {/* Reseña */}
            <div>
                <label htmlFor="review" className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-text block mb-2">
                    Reseña
                </label>
                <textarea
                    id="review"
                    value={review}
                    onChange={(e) => setReview(e.target.value.slice(0, MAX_REVIEW))}
                    placeholder="¿Cómo estuvo el show? ¿Qué momento fue el mejor?..."
                    rows={3}
                    className="w-full border border-ritual-border bg-ritual-surface px-4 py-3 font-body italic text-sm text-ritual-bone placeholder-ritual-gray-mid focus:border-ritual-red focus:outline-none focus:ring-1 focus:ring-ritual-red/40 resize-none"
                />
                <p className="text-right font-label text-[10px] text-ritual-gray-mid mt-1">{review.length}/{MAX_REVIEW}</p>
            </div>

            {/* Notas / Setlist */}
            <div>
                <label htmlFor="notes" className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-text block mb-2">
                    Notas / Setlist
                </label>
                <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value.slice(0, MAX_NOTES))}
                    placeholder="Canciones que tocaron, con quién fuiste, momentos especiales..."
                    rows={5}
                    className="w-full border border-ritual-border bg-ritual-surface px-4 py-3 font-label text-sm text-ritual-bone placeholder-ritual-gray-mid focus:border-ritual-red focus:outline-none focus:ring-1 focus:ring-ritual-red/40 resize-none"
                />
                <p className="text-right font-label text-[10px] text-ritual-gray-mid mt-1">{notes.length}/{MAX_NOTES}</p>
            </div>

            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex items-center justify-center bg-ritual-red px-5 py-2.5 font-label text-[10px] tracking-[0.14em] uppercase text-ritual-panel hover:bg-ritual-red-hover transition-colors disabled:opacity-50"
                >
                    {isPending ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar memoria'}
                </button>
                {error && <p className="font-label text-sm text-ritual-red">{error}</p>}
            </div>
        </form>
    )
}
