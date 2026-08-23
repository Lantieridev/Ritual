'use client'

import { useState, useTransition, useEffect } from 'react'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'

const SaveFestivalAttendanceMutation = gql`
  mutation SaveFestivalAttendance($festivalId: ID!, $status: AttendanceStatus!) {
    saveFestivalAttendance(festivalId: $festivalId, status: $status) { success error }
  }
`

interface FestivalAttendanceButtonProps {
    festivalId: string
    initialStatus?: 'interested' | 'going' | 'went'
}

const OPTIONS: { value: 'interested' | 'going' | 'went'; label: string; emoji: string }[] = [
    { value: 'interested', label: 'Me interesa', emoji: '👀' },
    { value: 'going', label: 'Voy', emoji: '🎟️' },
    { value: 'went', label: 'Fui ✓', emoji: '✅' },
]

export function FestivalAttendanceButton({ festivalId, initialStatus }: FestivalAttendanceButtonProps) {
    const [status, setStatus] = useState<'interested' | 'going' | 'went' | undefined>(initialStatus)
    const [open, setOpen] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [, saveFestivalAttendance] = useMutation(SaveFestivalAttendanceMutation)

    function handleSelect(value: 'interested' | 'going' | 'went') {
        const previous = status
        setStatus(value)
        setOpen(false)
        setError(null)
        startTransition(async () => {
            const result = unwrapMutation<{ success?: boolean; error?: string }>(
                await saveFestivalAttendance({ festivalId, status: value }),
                'saveFestivalAttendance',
                'No se pudo guardar la asistencia.'
            )
            if (result.error || !result.success) {
                setStatus(previous)
                setError(result.error ?? 'No se pudo guardar la asistencia.')
            }
        })
    }

    useEffect(() => {
        if (!open) return
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [open])

    const current = OPTIONS.find((o) => o.value === status)

    return (
        <div className="relative shrink-0">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                disabled={isPending}
                aria-haspopup="menu"
                aria-expanded={open}
                className={`inline-flex items-center gap-2 border px-4 py-2.5 font-label text-[10px] tracking-[0.1em] uppercase transition-all disabled:opacity-50 ${status === 'went'
                        ? 'border-ritual-red bg-ritual-red text-ritual-bone'
                        : status === 'going'
                            ? 'border-ritual-border-2 bg-ritual-surface-high text-ritual-bone'
                            : status === 'interested'
                                ? 'border-ritual-border bg-ritual-surface text-ritual-gray-light-3'
                                : 'border-ritual-border bg-ritual-surface text-ritual-gray-text hover:text-ritual-gray-text hover:border-ritual-border-2'
                    }`}
            >
                {isPending ? (
                    <span className="opacity-50">…</span>
                ) : (
                    <>
                        <span>{current?.emoji ?? '+'}</span>
                        {current?.label ?? 'Marcar asistencia'}
                    </>
                )}
                <span className="text-xs opacity-60">▾</span>
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div role="menu" className="absolute right-0 top-full mt-1 z-20 w-44 border border-ritual-border bg-ritual-panel-2 shadow-xl overflow-hidden">
                        {OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                role="menuitemradio"
                                aria-checked={status === opt.value}
                                onClick={() => handleSelect(opt.value)}
                                className={`w-full flex items-center gap-2.5 px-4 py-2.5 font-label text-[10px] tracking-[0.1em] uppercase transition-colors hover:bg-ritual-surface ${status === opt.value ? 'text-ritual-bone' : 'text-ritual-gray-text'
                                    }`}
                            >
                                {opt.label}
                                {status === opt.value && <span className="ml-auto text-ritual-red-hover">✓</span>}
                            </button>
                        ))}
                    </div>
                </>
            )}

            {error && (
                <p role="alert" className="absolute right-0 top-full mt-1 w-56 font-label text-xs text-ritual-red-hover">
                    {error}
                </p>
            )}
        </div>
    )
}
