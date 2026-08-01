'use client'

import { useState, type ReactNode } from 'react'
import { Button } from './Button'

interface ConfirmDeleteButtonProps {
    /** Texto del botón inicial, ej. "Eliminar recital". */
    label: string
    /** Mensaje de confirmación mostrado tras el primer click. */
    confirmMessage: ReactNode
    /** Ejecuta el borrado. El caller ya tiene el id atado por closure. */
    onConfirm: () => Promise<{ error?: string } | undefined>
}

/**
 * Confirmación de borrado en 2 pasos (click → confirmar/cancelar).
 * DeleteEventButton y DeleteExpenseButton eran casi la misma implementación
 * copiada dos veces — este componente es la única fuente de ese patrón.
 */
export function ConfirmDeleteButton({ label, confirmMessage, onConfirm }: ConfirmDeleteButtonProps) {
    const [isConfirming, setIsConfirming] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    if (!isConfirming) {
        return (
            <Button
                type="button"
                variant="ghost"
                className="text-ritual-red-hover hover:text-ritual-red-hover hover:bg-ritual-red/10"
                onClick={() => { setIsConfirming(true); setError(null) }}
            >
                {label}
            </Button>
        )
    }

    return (
        <div className="border border-ritual-border bg-ritual-surface p-4 space-y-3">
            <p className="font-body text-sm text-ritual-gray-light-3">{confirmMessage}</p>
            {error && (
                <p role="alert" className="font-body text-sm text-ritual-red-hover">
                    {error}
                </p>
            )}
            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="primary"
                    className=""
                    disabled={isDeleting}
                    onClick={async () => {
                        setIsDeleting(true)
                        setError(null)
                        const result = await onConfirm()
                        if (result?.error) {
                            setError(result.error)
                            setIsDeleting(false)
                        }
                    }}
                >
                    {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    disabled={isDeleting}
                    onClick={() => setIsConfirming(false)}
                >
                    Cancelar
                </Button>
            </div>
        </div>
    )
}
