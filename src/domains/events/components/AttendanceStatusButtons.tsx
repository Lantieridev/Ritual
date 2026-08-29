'use client'

import { useState, useTransition } from 'react'
import { setAttendanceStatus } from '@/src/domains/events/attendance-actions'
import type { AttendanceStatus } from '@/src/domains/events/attendance-actions'

interface StatusButtonProps {
    eventId: string
    currentStatus: AttendanceStatus | null
    isPast: boolean
}

/**
 * Opciones de asistencia según si el evento ya pasó o no.
 *
 * Pasado:   solo "Fui" (no tiene sentido "quiero ir" a algo que ya fue)
 * Futuro:   "Me interesa" y "Voy a ir" (no "Fui" — todavía no pasó)
 */
const PAST_OPTIONS: { value: AttendanceStatus; label: string; emoji: string }[] = [
    { value: 'went', label: 'Fui', emoji: '✅' },
]

const FUTURE_OPTIONS: { value: AttendanceStatus; label: string; emoji: string }[] = [
    { value: 'interested', label: 'Me interesa', emoji: '👀' },
    { value: 'going', label: 'Voy a ir', emoji: '🎟️' },
]

export function AttendanceStatusButtons({ eventId, currentStatus, isPast }: StatusButtonProps) {
    const [activeStatus, setActiveStatus] = useState<AttendanceStatus | null>(currentStatus)
    const [loadingStatus, setLoadingStatus] = useState<AttendanceStatus | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [, startTransition] = useTransition()

    const options = isPast ? PAST_OPTIONS : FUTURE_OPTIONS

    function handleSelect(status: AttendanceStatus) {
        if (loadingStatus) return
        // Toggle: si ya está activo, deseleccionar (no tiene sentido en este contexto, pero por si acaso)
        setLoadingStatus(status)
        setError(null)
        startTransition(async () => {
            const result = await setAttendanceStatus(eventId, status)
            if (result.error) {
                setError(result.error)
            } else {
                setActiveStatus(status)
            }
            setLoadingStatus(null)
        })
    }

    return (
        <div>
            <div className="flex border border-ritual-border">
                {options.map(({ value, label }) => {
                    const isActive = activeStatus === value
                    const isLoading = loadingStatus === value
                    return (
                        <button
                            key={value}
                            type="button"
                            disabled={Boolean(loadingStatus)}
                            onClick={() => handleSelect(value)}
                            className={`flex-1 px-4 py-3 font-label text-[10px] tracking-[0.14em] uppercase transition-all disabled:cursor-not-allowed border-r border-ritual-border last:border-r-0 ${isActive
                                    ? 'bg-ritual-red text-ritual-bone'
                                    : 'text-ritual-gray-text hover:bg-ritual-surface hover:text-ritual-bone'
                                }`}
                        >
                            {isLoading ? '…' : label}
                        </button>
                    )
                })}
            </div>

            {error && (
                <p role="alert" className="mt-2 font-label text-xs text-ritual-red-hover">
                    {error}
                </p>
            )}

            {/* Si el status guardado no coincide con las opciones disponibles, mostrar aviso */}
            {activeStatus && !options.find((o) => o.value === activeStatus) && (
                <p className="mt-2 font-body text-xs text-ritual-gray-text">
                    {isPast
                        ? 'Tenías marcado "quiero ir" — ¿finalmente fuiste?'
                        : 'Tenías marcado "fui" para un show futuro.'}
                </p>
            )}
        </div>
    )
}
