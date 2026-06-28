import { ShortcutCell } from '@/src/core/components/ui'
import type { ProfileHubCellData } from '@/src/domains/auth/profile-hub-view'

interface ProfileHubGridProps {
    cells: readonly ProfileHubCellData[]
}

/**
 * Grid 2x2 de atajos del hub "Vos" (`app/profile`, mobile) — `<ul>`/`<li>`
 * de links, mismo criterio de semántica de lista que `coleccion/page.tsx:229`
 * (D-7, design perfil-mobile). Server: sin estado, cada celda es un
 * `ShortcutCell`.
 */
export function ProfileHubGrid({ cells }: ProfileHubGridProps) {
    return (
        <ul className="grid grid-cols-2">
            {cells.map((cell) => (
                <li key={cell.caption}>
                    <ShortcutCell value={cell.value} caption={cell.caption} href={cell.href} tone={cell.tone} />
                </li>
            ))}
        </ul>
    )
}
