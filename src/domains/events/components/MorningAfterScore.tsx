'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveMemory } from '@/src/domains/events/attendance-actions'

const SCORES = [1, 2, 3, 4, 5] as const

/**
 * Puntaje en un toque para "la mañana después". El prototipo dibuja 1–10 en
 * dos filas de cinco, pero el rating de Ritual es de 1 a 5 (validateRating),
 * así que va una sola fila: mismo alto táctil de 48px, cada botón más ancho.
 * Al guardar se refresca la página y Home sale de este estado.
 */
export function MorningAfterScore({ eventId }: { eventId: string }) {
    const router = useRouter()
    const [picked, setPicked] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function rate(score: number) {
        setPicked(score)
        setError(null)
        startTransition(async () => {
            const result = await saveMemory(eventId, { rating: score })
            if ('error' in result && result.error) {
                setError(result.error)
                setPicked(null)
                return
            }
            router.refresh()
        })
    }

    return (
        <div className="mt-4">
            <div role="group" aria-label="Puntaje del show" className="grid grid-cols-5 gap-[5px]">
                {SCORES.map((score) => {
                    const lit = picked !== null && score <= picked
                    return (
                        <button
                            key={score}
                            type="button"
                            disabled={isPending}
                            onClick={() => rate(score)}
                            aria-pressed={picked === score}
                            className={`min-h-[48px] flex items-center justify-center font-figure text-[19px] tracking-[0.06em] disabled:cursor-wait ${lit ? 'bg-ritual-red text-ritual-panel' : 'bg-ritual-surface-high text-ritual-gray-muted-2'}`}
                        >
                            {score}
                        </button>
                    )
                })}
            </div>
            {error && (
                <p role="alert" className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-red-hover mt-2">
                    {error}
                </p>
            )}
        </div>
    )
}
