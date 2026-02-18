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
    const [, startTransition] = useTransition()

    const options = isPast ? PAST_OPTIONS : FUTURE_OPTIONS

    function handleSelect(status: AttendanceStatus) {
        if (loadingStatus) return
        // Toggle: si ya está activo, deseleccionar (no tiene sentido en este contexto, pero por si acaso)
        setLoadingStatus(status)
        startTransition(async () => {
            const result = await setAttendanceStatus(eventId, status)
            if (!result.error) setActiveStatus(status)
            setLoadingStatus(null)
        })
    }

    return (
        <div className="flex flex-wrap gap-2">
            {options.map(({ value, label, emoji }) => {
                const isActive = activeStatus === value
                const isLoading = loadingStatus === value
                return (
                    <button
                        key={value}
                        type="button"
                        disabled={Boolean(loadingStatus)}
                        onClick={() => handleSelect(value)}
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed ${isActive
                                ? 'bg-white text-neutral-950'
                                : 'border border-white/15 text-zinc-400 hover:border-white/30 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <span>{isLoading ? '…' : emoji}</span>
                        {label}
                    </button>
                )
            })}

            {/* Si el status guardado no coincide con las opciones disponibles, mostrar aviso */}
            {activeStatus && !options.find((o) => o.value === activeStatus) && (
                <p className="text-xs text-zinc-600 self-center">
                    {isPast
                        ? 'Tenías marcado "quiero ir" — ¿finalmente fuiste?'
                        : 'Tenías marcado "fui" para un show futuro.'}
                </p>
            )}
        </div>
    )
}
