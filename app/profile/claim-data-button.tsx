'use client'

import { useTransition } from 'react'
import { claimLegacyData } from '@/src/core/auth/actions'

export function ClaimDataButton() {
    const [isPending, startTransition] = useTransition()

    function handleClaim() {
        if (!confirm('¿Estás seguro de que querés reclamar los datos del usuario desarrollador anterior? Esto asignará todos los eventos existentes a tu cuenta.')) {
            return
        }

        startTransition(async () => {
            const res = await claimLegacyData()
            if (res?.error) {
                alert('Error al reclamar datos: ' + res.error)
            } else {
                alert('¡Datos reclamados con éxito!')
                window.location.reload()
            }
        })
    }

    return (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6">
            <h3 className="text-lg font-bold text-amber-400 mb-2">⚠️ Zona de Migración</h3>
            <p className="text-sm text-zinc-300 mb-4">
                Si sos el desarrollador y acabás de crear tu cuenta, tocá acá para asignarte todos los recitales, artistas y venues que cargaste antes.
            </p>
            <button
                onClick={handleClaim}
                disabled={isPending}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
            >
                {isPending ? 'Migrando...' : 'Reclamar mis datos antiguos'}
            </button>
        </div>
    )
}
