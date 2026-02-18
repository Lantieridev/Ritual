'use client'

import { useState, useTransition } from 'react'
import { toggleWishlist } from '@/src/domains/artists/wishlist-actions'

interface WishlistButtonProps {
    artistId: string
    initialInWishlist: boolean
}

export function WishlistButton({ artistId, initialInWishlist }: WishlistButtonProps) {
    const [inWishlist, setInWishlist] = useState(initialInWishlist)
    const [isPending, startTransition] = useTransition()

    function handleToggle() {
        // Optimistic update
        setInWishlist((prev) => !prev)
        startTransition(async () => {
            const result = await toggleWishlist(artistId)
            if (result.error) {
                // Revert on error
                setInWishlist((prev) => !prev)
            } else {
                setInWishlist(result.inWishlist)
            }
        })
    }

    return (
        <button
            onClick={handleToggle}
            disabled={isPending}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all disabled:opacity-50 ${inWishlist
                    ? 'border-white/30 bg-white/10 text-white hover:bg-white/5'
                    : 'border-white/15 bg-white/[0.04] text-zinc-400 hover:border-white/25 hover:text-white'
                }`}
            aria-label={inWishlist ? 'Dejar de seguir este artista' : 'Seguir este artista'}
        >
            <span className={`text-base transition-transform ${isPending ? 'scale-90' : 'scale-100'}`}>
                {inWishlist ? '★' : '☆'}
            </span>
            {inWishlist ? 'Siguiendo' : 'Seguir'}
        </button>
    )
}
