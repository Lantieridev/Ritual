'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import { Input } from '@/src/core/components/ui/Input'
import { Button } from '@/src/core/components/ui/Button'

const ConnectLastfmMutation = gql`
  mutation ConnectLastfm($username: String!) {
    connectLastfm(username: $username) { error }
  }
`

const DisconnectLastfmMutation = gql`
  mutation DisconnectLastfm {
    disconnectLastfm { error }
  }
`

export interface LastfmConnectProps {
    lastfmUsername?: string | null
}

/**
 * Conecta o desconecta Last.fm desde el perfil — formulario separado de
 * `TasteProfileForm`, cada uno con su propia mutation (ver ProfileForm para
 * el criterio de una sola escritura por formulario).
 */
export function LastfmConnect({ lastfmUsername = null }: LastfmConnectProps) {
    const router = useRouter()
    const [, connect] = useMutation(ConnectLastfmMutation)
    const [, disconnect] = useMutation(DisconnectLastfmMutation)
    const [connectedAs, setConnectedAs] = useState(lastfmUsername)
    const [username, setUsername] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isPending, setIsPending] = useState(false)

    async function handleConnect(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError(null)
        setIsPending(true)

        const result = unwrapMutation(
            await connect({ username }),
            'connectLastfm',
            'No pudimos conectar tu cuenta de Last.fm.'
        )

        if (result.error) {
            setError(result.error)
            setIsPending(false)
            return
        }

        setConnectedAs(username)
        setIsPending(false)
        router.refresh()
    }

    async function handleDisconnect() {
        setError(null)
        setIsPending(true)

        const result = unwrapMutation(
            await disconnect({}),
            'disconnectLastfm',
            'No pudimos desconectar tu cuenta de Last.fm.'
        )

        if (result.error) {
            setError(result.error)
            setIsPending(false)
            return
        }

        setConnectedAs(null)
        setUsername('')
        setIsPending(false)
        router.refresh()
    }

    if (connectedAs) {
        return (
            <div className="space-y-3">
                <p className="font-body text-sm text-ritual-gray-light-3">
                    Conectado como <span className="text-ritual-bone">{connectedAs}</span>
                </p>
                <p className="font-body text-xs text-ritual-gray-text">
                    Al desconectar se borran los artistas importados de Last.fm.
                </p>

                {error && (
                    <div role="alert" className="p-4 bg-ritual-red/10 border border-ritual-red/20 text-ritual-red-hover font-body text-sm">
                        {error}
                    </div>
                )}

                <Button variant="secondary" onClick={handleDisconnect} disabled={isPending}>
                    {isPending ? 'Desconectando...' : 'Desconectar'}
                </Button>
            </div>
        )
    }

    return (
        <form onSubmit={handleConnect} className="space-y-3">
            <Input
                label="Usuario de Last.fm"
                id="lastfmUsername"
                name="lastfmUsername"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. rj"
            />

            {error && (
                <div role="alert" className="p-4 bg-ritual-red/10 border border-ritual-red/20 text-ritual-red-hover font-body text-sm">
                    {error}
                </div>
            )}

            <Button type="submit" disabled={isPending}>
                {isPending ? 'Conectando...' : 'Conectar'}
            </Button>
        </form>
    )
}
