import Link from 'next/link'
import { routes } from '@/src/core/lib/routes'

const NAV_LINKS = [
    { label: 'Inicio', href: routes.home },
    { label: 'Buscar', href: routes.events.search },
    { label: 'Artistas', href: routes.artists.list },
    { label: 'Sedes', href: routes.venues.list },
    { label: 'Stats', href: routes.stats },
]

/**
 * Navbar global sticky con efecto backdrop-blur.
 * Se renderiza en app/layout.tsx y persiste en toda la navegación.
 */
export function Navbar() {
    return (
        <header className="fixed top-0 inset-x-0 z-50 h-16 border-b border-white/[0.06] bg-neutral-950/80 backdrop-blur-md">
            <div className="max-w-7xl mx-auto h-full px-6 md:px-8 flex items-center justify-between gap-8">
                {/* Logo */}
                <Link
                    href={routes.home}
                    className="text-sm font-bold tracking-[0.2em] uppercase text-white hover:text-zinc-300 transition-colors shrink-0"
                >
                    RITUAL
                </Link>

                {/* Nav links */}
                <nav className="flex items-center gap-1 overflow-x-auto">
                    {NAV_LINKS.map(({ label, href }) => (
                        <Link
                            key={href}
                            href={href}
                            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white rounded-md hover:bg-white/5 transition-colors whitespace-nowrap"
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
            </div>
        </header>
    )
}
