'use client'

import { ConfirmDeleteButton } from '@/src/core/components/ui'
import type { EventWithRelations } from '@/src/core/types'

interface DeleteEventButtonProps {
  event: EventWithRelations
  deleteEvent: (id: string) => Promise<{ error?: string }>
}

export function DeleteEventButton({ event, deleteEvent }: DeleteEventButtonProps) {
  return (
    <ConfirmDeleteButton
      label="Eliminar recital"
      confirmMessage={
        <>
          ¿Eliminar <strong>{event.name || 'este recital'}</strong>? Se borrarán también los artistas del lineup. Esta acción no se puede deshacer.
        </>
      }
      onConfirm={() => deleteEvent(event.id)}
    />
  )
}
