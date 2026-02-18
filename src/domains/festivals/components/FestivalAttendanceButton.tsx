'use client'

import { useState, useTransition } from 'react'
import { saveFestivalAttendance } from '@/src/domains/festivals/actions'

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
    const [isPending, startTransition] = useTransition()

    function handleSelect(value: 'interested' | 'going' | 'went') {
        setStatus(value)
        setOpen(false)
        startTransition(async () => {
            await saveFestivalAttendance(festivalId, value)
        })
    }

    const current = OPTIONS.find((o) => o.value === status)

    return (
        <div className="relative shrink-0">
            <button
                onClick={() => setOpen((v) => !v)}
                disabled={isPending}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 ${status === 'went'
                        ? 'border-white/20 bg-white text-neutral-950'
                        : status === 'going'
                            ? 'border-white/20 bg-white/10 text-white'
                            : status === 'interested'
                                ? 'border-white/15 bg-white/[0.06] text-zinc-300'
                                : 'border-white/15 bg-white/[0.04] text-zinc-500 hover:text-zinc-300 hover:border-white/25'
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
                    <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border border-white/10 bg-neutral-900 shadow-xl overflow-hidden">
                        {OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => handleSelect(opt.value)}
                                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-white/5 ${status === opt.value ? 'text-white font-semibold' : 'text-zinc-400'
                                    }`}
                            >
                                <span>{opt.emoji}</span>
                                {opt.label}
                                {status === opt.value && <span className="ml-auto text-xs">✓</span>}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
