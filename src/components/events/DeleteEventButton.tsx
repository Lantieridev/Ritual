'use client'

import { useState } from 'react'
import { Button } from '@/src/components/ui'
import type { EventWithRelations } from '@/src/lib/types'

interface DeleteEventButtonProps {
  event: EventWithRelations
  deleteEvent: (id: string) => Promise<{ error?: string }>
}

/**
 * Botón de eliminar recital con confirmación.
 * Client Component: confirmación inline para evitar borrados accidentales.
 */
export function DeleteEventButton({ event, deleteEvent }: DeleteEventButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  function handleFirstClick() {
    setIsConfirming(true)
    setError(null)
  }

  function handleCancel() {
    setIsConfirming(false)
  }

  async function handleConfirm() {
    setIsDeleting(true)
    setError(null)
    const result = await deleteEvent(event.id)
    if (result?.error) {
      setError(result.error)
      setIsDeleting(false)
      return
    }
    // redirect lo hace la action
  }

  if (!isConfirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
        onClick={handleFirstClick}
      >
        Eliminar recital
      </Button>
    )
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
      <p className="text-sm text-zinc-300">
        ¿Eliminar <strong>{event.name || 'este recital'}</strong>? Se borrarán también los artistas del lineup. Esta acción no se puede deshacer.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="primary"
          className="bg-red-600 hover:bg-red-500 text-white"
          onClick={handleConfirm}
          disabled={isDeleting}
        >
          {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
        </Button>
        <Button type="button" variant="secondary" onClick={handleCancel} disabled={isDeleting}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
