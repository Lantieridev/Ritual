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
    )
}
