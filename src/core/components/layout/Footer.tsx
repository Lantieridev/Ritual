import Link from 'next/link'
import { routes } from '@/src/core/lib/routes'

const FOOTER_LINKS = [
    { label: 'Buscar', href: routes.events.search },
    { label: 'Colección', href: routes.collection },
]

/**
 * Footer global minimalista.
 * Se renderiza en app/layout.tsx debajo de {children}.
 */
export function Footer() {
    return (
        <footer className="border-t border-ritual-border-subtle bg-ritual-panel">
            <div className="max-w-7xl mx-auto px-6 md:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="font-label text-[9px] text-ritual-gray-mid tracking-[0.14em] uppercase">
                    © {new Date().getFullYear()} RITUAL
                </p>
                <nav className="flex items-center gap-4">
                    {FOOTER_LINKS.map(({ label, href }) => (
                        <Link
                            key={href}
                            href={href}
                            className="font-label text-[9px] text-ritual-gray-mid hover:text-ritual-gray-text uppercase tracking-[0.14em] transition-colors"
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
            </div>
        </footer>
    )
}
