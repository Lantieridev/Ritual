'use client'

import { useState, useTransition } from 'react'
import { saveMemory } from '@/src/domains/events/attendance-actions'

interface RatingAndReviewFormProps {
    eventId: string
    initialRating?: number | null
    initialReview?: string | null
}

/**
 * Formulario de rating (1-5 estrellas) y reseña personal del show.
 * Guarda en la tabla memories vinculada al attendance del evento.
 */
export function RatingAndReviewForm({
    eventId,
    initialRating,
    initialReview,
}: RatingAndReviewFormProps) {
    const [rating, setRating] = useState<number>(initialRating ?? 0)
    const [hovered, setHovered] = useState<number>(0)
    const [review, setReview] = useState(initialReview ?? '')
    const [saved, setSaved] = useState(false)
    const [isPending, startTransition] = useTransition()

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaved(false)
        startTransition(async () => {
            await saveMemory(eventId, {
                rating: rating > 0 ? rating : undefined,
                review: review.trim() || undefined,
            })
            setSaved(true)
        })
    }

    const displayRating = hovered || rating

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Estrellas */}
            <div>
                <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Tu rating</p>
                <div className="flex gap-1" role="group" aria-label="Rating del show">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHovered(star)}
                            onMouseLeave={() => setHovered(0)}
                            className="text-2xl transition-transform hover:scale-110 focus:outline-none"
                            aria-label={`${star} estrella${star > 1 ? 's' : ''}`}
                        >
                            <span className={displayRating >= star ? 'text-white' : 'text-zinc-700'}>
                                ★
                            </span>
                        </button>
                    ))}
                    {rating > 0 && (
                        <button
                            type="button"
                            onClick={() => setRating(0)}
                            className="ml-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors self-center"
                        >
                            Borrar
                        </button>
                    )}
                </div>
            </div>

            {/* Reseña */}
            <div>
                <label htmlFor="review" className="text-xs uppercase tracking-widest text-zinc-500 block mb-2">
                    Tu reseña
                </label>
                <textarea
                    id="review"
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    placeholder="¿Cómo estuvo el show? ¿Qué momento fue el mejor?..."
                    rows={3}
                    className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                />
            </div>

            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-2 text-sm font-semibold text-neutral-950 hover:bg-zinc-100 transition-colors disabled:opacity-50"
                >
                    {isPending ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar memoria'}
                </button>
            </div>
        </form>
    )
}
