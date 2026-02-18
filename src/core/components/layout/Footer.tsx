import Link from 'next/link'
import { routes } from '@/src/core/lib/routes'

const FOOTER_LINKS = [
    { label: 'Buscar', href: routes.events.search },
    { label: 'Artistas', href: routes.artists.list },
    { label: 'Sedes', href: routes.venues.list },
]

/**
 * Footer global minimalista.
 * Se renderiza en app/layout.tsx debajo de {children}.
 */
export function Footer() {
    return (
        <footer className="border-t border-white/[0.06] bg-neutral-950">
            <div className="max-w-7xl mx-auto px-6 md:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-zinc-600 tracking-widest uppercase">
                    © {new Date().getFullYear()} RITUAL
                </p>
                <nav className="flex items-center gap-4">
                    {FOOTER_LINKS.map(({ label, href }) => (
                        <Link
                            key={href}
                            href={href}
                            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
            </div>
        </footer>
    )
}
