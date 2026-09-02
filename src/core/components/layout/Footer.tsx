import Link from 'next/link'
import { routes } from '@/src/core/lib/routes'

const FOOTER_LINKS = [
    { label: 'Buscar', href: routes.events.search },
    { label: 'Colección', href: routes.collection },
]

/**
 * Footer global minimalista.
 * Se renderiza en app/layout.tsx debajo de {children}.
 * Es el último punto de la página en toda la app, así que en mobile lleva el
 * aire de `--ritual-mobile-clearance` (globals.css): sin él quedaría tapado
 * detrás del talón fijo y de la acción principal, si la pantalla tiene una.
 */
export function Footer() {
    return (
        <footer className="border-t border-ritual-border-subtle bg-ritual-panel pb-[var(--ritual-mobile-clearance)] md:pb-0">
            <div className="max-w-7xl mx-auto px-6 md:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="font-label text-[9px] text-ritual-gray-text tracking-[0.14em] uppercase">
                    © {new Date().getFullYear()} RITUAL
                </p>
                <nav className="flex items-center gap-4">
                    {FOOTER_LINKS.map(({ label, href }) => (
                        <Link
                            key={href}
                            href={href}
                            className="inline-flex items-center min-h-[44px] md:min-h-0 font-label text-[9px] text-ritual-gray-text hover:text-ritual-gray-text uppercase tracking-[0.14em] transition-colors"
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
            </div>
        </footer>
    )
}
