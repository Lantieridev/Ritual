import Link from 'next/link'

export type BottomSheetItemTone = 'acento' | 'apagado'

interface BottomSheetItemBase {
    label: string
    hint?: string
    /** Sin tone => bone, el color por defecto de una fila (.dc.html:1312). */
    tone?: BottomSheetItemTone
}

type BottomSheetItemProps =
    | (BottomSheetItemBase & { to: string; onClick?: never })
    | (BottomSheetItemBase & { onClick: () => void; to?: never })

const TONE_CLASS: Record<BottomSheetItemTone, string> = {
    acento: 'text-ritual-red',
    apagado: 'text-ritual-gray-text',
}
const DEFAULT_TONE_CLASS = 'text-ritual-bone'

const ROW_CLASS =
    'flex min-h-[56px] w-full items-center justify-between gap-3 border-b border-ritual-mobile-sheet-divider py-3.5 text-left'

/**
 * Fila del bottom sheet (.dc.html:903-909) — unión discriminada sobre `to`
 * (Link de Next) vs `onClick` (button), igual que decide el diseño.
 */
export function BottomSheetItem({ label, hint, tone, ...action }: BottomSheetItemProps) {
    const labelClass = tone ? TONE_CLASS[tone] : DEFAULT_TONE_CLASS

    const content = (
        <>
            <div>
                <div className={`font-subtitle text-[23px] font-black uppercase leading-none ${labelClass}`}>
                    {label}
                </div>
                {hint && <div className="mt-[3px] font-body text-[12px] text-ritual-gray-mid-2">{hint}</div>}
            </div>
            <div aria-hidden="true" className="font-label text-[13px] text-ritual-red">
                →
            </div>
        </>
    )

    if ('to' in action && action.to) {
        return (
            <Link href={action.to} className={ROW_CLASS}>
                {content}
            </Link>
        )
    }

    return (
        <button type="button" onClick={action.onClick} className={ROW_CLASS}>
            {content}
        </button>
    )
}
