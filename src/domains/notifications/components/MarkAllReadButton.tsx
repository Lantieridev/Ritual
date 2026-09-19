'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import { Button } from '@/src/core/components/ui/Button'

const MarkAllReadMutation = gql`
  mutation MarkAllNotificationsRead {
    markNotificationsRead { error }
  }
`

export function MarkAllReadButton() {
    const router = useRouter()
    const [, markAllRead] = useMutation(MarkAllReadMutation)
    const [error, setError] = useState<string | null>(null)

    async function handleClick() {
        setError(null)
        const result = unwrapMutation(await markAllRead({}), 'markNotificationsRead', 'No pudimos marcar tus avisos como leídos.')
        if (result.error) {
            setError(result.error)
            return
        }
        router.refresh()
    }

    return (
        <div>
            <Button type="button" onClick={handleClick}>Marcar todo como leído</Button>
            {error && <p role="alert" className="text-sm text-ritual-red-hover">{error}</p>}
        </div>
    )
}
