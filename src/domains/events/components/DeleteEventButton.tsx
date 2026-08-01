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
      label="Romper este talón"
      confirmMessage={
        <>
          ¿Romper el talón de <strong>{event.name || 'este recital'}</strong>? Se pierde también el lineup, las fotos y tu reseña. No se puede deshacer.
        </>
      }
      onConfirm={() => deleteEvent(event.id)}
    />
  )
}
