'use client'

import { useState, useTransition } from 'react'
import { useMutation, gql } from 'urql'

const ToggleWishlistMutation = gql`
  mutation ToggleWishlist($artistId: ID!) {
    toggleWishlist(artistId: $artistId) { inWishlist error }
  }
`

interface WishlistButtonProps {
    artistId: string
    initialInWishlist: boolean
}

export function WishlistButton({ artistId, initialInWishlist }: WishlistButtonProps) {
    const [inWishlist, setInWishlist] = useState(initialInWishlist)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [, toggleWishlist] = useMutation(ToggleWishlistMutation)

    function handleToggle() {
        // Optimistic update
        setInWishlist((prev) => !prev)
        setError(null)
        startTransition(async () => {
            const { data } = await toggleWishlist({ artistId })
            const result = data?.toggleWishlist
            if (!result || result.error) {
                setInWishlist((prev) => !prev)
                setError(result?.error ?? 'No se pudo actualizar la wishlist.')
            } else {
                setInWishlist(result.inWishlist)
            }
        })
    }

    return (
        <div className="inline-flex flex-col items-start gap-1">
            <button
                onClick={handleToggle}
                disabled={isPending}
                className={`inline-flex items-center gap-2.5 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 ${inWishlist
                        ? 'border-white/20 bg-white text-neutral-950 hover:bg-zinc-100'
                        : 'border-white/15 bg-white/[0.06] text-zinc-300 hover:border-white/30 hover:text-white hover:bg-white/10'
                    }`}
                aria-label={inWishlist ? 'Dejar de seguir este artista' : 'Seguir este artista'}
            >
                <span className={`text-base transition-all duration-200 ${isPending ? 'opacity-50 scale-75' : 'scale-100'}`}>
                    {inWishlist ? '★' : '☆'}
                </span>
                {isPending ? '…' : inWishlist ? 'Siguiendo' : 'Seguir'}
            </button>
            {error && (
                <p role="alert" className="text-xs text-red-400">
                    {error}
                </p>
            )}
        </div>
    )
}
