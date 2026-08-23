'use client'

import { useMutation, gql } from 'urql'
import { useRouter } from 'next/navigation'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import { routes } from '@/src/core/lib/routes'
import { DeleteEventButton } from './DeleteEventButton'
import type { EventWithRelations } from '@/src/core/types'

const DeleteEventMutation = gql`
  mutation DeleteEvent($id: ID!) {
    deleteEvent(id: $id) { error }
  }
`

/**
 * Ata el borrado a GraphQL y decide la navegación, dejando a
 * DeleteEventButton como lo que era: la confirmación en dos pasos, sin saber
 * de dónde sale el borrado. Mismo reparto que DeleteExpenseAction.
 */
export function DeleteEventAction({ event }: { event: EventWithRelations }) {
  const router = useRouter()
  const [, deleteEvent] = useMutation(DeleteEventMutation)

  const handleDelete = async (id: string) => {
    const result = unwrapMutation(await deleteEvent({ id }), 'deleteEvent', 'No se pudo eliminar el recital.')
    if (result.error) {
      return { error: result.error }
    }
    router.push(routes.home)
    return {}
  }

  return <DeleteEventButton event={event} deleteEvent={handleDelete} />
}
