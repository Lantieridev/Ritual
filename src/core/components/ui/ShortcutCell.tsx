import Link from 'next/link'

export interface ShortcutCellProps {
    value: string
    caption: string
    href: string
    tone?: 'acento'
}

const VALUE_TONE_CLASS: Record<'acento', string> = {
    acento: 'text-ritual-red',
}
const DEFAULT_VALUE_CLASS = 'text-ritual-bone'

/**
 * Celda tappable de 104×104 del grid 2×2 de "Vos" (`app/profile`, mobile) —
 * valor + caption + link. Presentacional puro, sin conocimiento de auth: por
 * eso vive en core/ui junto a BottomSheetItem, no en domains/auth/components
 * (D-2, design perfil-mobile).
 */
export function ShortcutCell({ value, caption, href, tone }: ShortcutCellProps) {
    const valueClass = tone ? VALUE_TONE_CLASS[tone] : DEFAULT_VALUE_CLASS

    return (
        <Link
            href={href}
            className="flex min-h-[104px] flex-col justify-end border-b border-r border-ritual-surface-high p-4"
        >
            <span className={`font-display text-[30px] ${valueClass}`}>{value}</span>
            <span className="mt-2 font-figure text-[16px] tracking-[0.1em] lowercase text-ritual-gray-light-3">
                {caption}
            </span>
        </Link>
    )
}
