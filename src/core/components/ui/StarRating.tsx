'use client'

import { useState } from 'react'

const SIZE_CLASS = {
    xs: 'text-xs',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
} as const

interface StarRatingProps {
    /** Current rating, 0-5. */
    value: number
    /** Omit for a read-only display; pass a handler to make it interactive. */
    onChange?: (star: number) => void
    size?: keyof typeof SIZE_CLASS
    className?: string
    ariaLabel?: string
}

/**
 * Shared 5-star rating widget. Renders read-only spans when `onChange` is
 * omitted, or clickable buttons with hover preview when it's provided —
 * same component, same visual language, for both display and input use.
 */
export function StarRating({
    value,
    onChange,
    size = 'lg',
    className = '',
    ariaLabel = 'Rating',
}: StarRatingProps) {
    const [hovered, setHovered] = useState(0)

    if (!onChange) {
        return (
            <div className={`flex gap-0.5 ${className}`}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <span
                        key={star}
                        className={`${SIZE_CLASS[size]} ${star <= value ? 'text-ritual-red' : 'text-ritual-border-2'}`}
                    >
                        ★
                    </span>
                ))}
            </div>
        )
    }

    const displayValue = hovered || value

    return (
        <div className={`flex gap-1 ${className}`} role="group" aria-label={ariaLabel}>
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => onChange(star)}
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    className={`${SIZE_CLASS[size]} transition-transform hover:scale-110 focus:outline-none`}
                    aria-label={`${star} estrella${star > 1 ? 's' : ''}`}
                >
                    <span className={displayValue >= star ? 'text-ritual-red' : 'text-ritual-border-2'}>★</span>
                </button>
            ))}
        </div>
    )
}
