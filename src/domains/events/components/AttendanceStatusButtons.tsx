'use client'

import { useState, useTransition } from 'react'
import { setAttendanceStatus } from '@/src/domains/events/attendance-actions'
import type { AttendanceStatus } from '@/src/domains/events/attendance-actions'

interface StatusButtonProps {
    eventId: string
    currentStatus: AttendanceStatus | null
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; emoji: string }[] = [
    { value: 'interested', label: 'Me interesa', emoji: '👀' },
    { value: 'going', label: 'Voy a ir', emoji: '🎟️' },
    { value: 'went', label: 'Fui', emoji: '✅' },
]

/**
 * Botones de estado de asistencia: Interesado / Voy / Fui.
 * Actualiza en Supabase con loading state por botón.
 */
export function AttendanceStatusButtons({ eventId, currentStatus }: StatusButtonProps) {
    const [activeStatus, setActiveStatus] = useState<AttendanceStatus | null>(currentStatus)
    const [loadingStatus, setLoadingStatus] = useState<AttendanceStatus | null>(null)
    const [, startTransition] = useTransition()

    function handleSelect(status: AttendanceStatus) {
        if (loadingStatus) return
        setLoadingStatus(status)
        startTransition(async () => {
            const result = await setAttendanceStatus(eventId, status)
            if (!result.error) setActiveStatus(status)
            setLoadingStatus(null)
        })
    }

    return (
        <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(({ value, label, emoji }) => {
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
        </div>
    )
}
