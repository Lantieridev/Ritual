'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { routes } from '@/src/core/lib/routes'

const NAV_LINKS = [
    { label: 'Inicio', href: routes.home },
    { label: 'Buscar', href: routes.events.search },
    { label: 'Artistas', href: routes.artists.list },
    { label: 'Festivales', href: routes.festivals.list },
    { label: 'Sedes', href: routes.venues.list },
    { label: 'Wishlist', href: routes.wishlist },
    { label: 'Gastos', href: routes.expenses.list },
    { label: 'Stats', href: routes.stats },
]

/**
 * Navbar global sticky con efecto backdrop-blur y active link indicator.
 * Se renderiza en app/layout.tsx y persiste en toda la navegación.
 */
export function Navbar() {
    const pathname = usePathname()

    function isActive(href: string) {
        if (href === '/') return pathname === '/'
        return pathname.startsWith(href)
    }

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

                {/* Nav links — scrollable on mobile with fade */}
                <nav className="relative flex-1 overflow-hidden">
                    <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none pr-8">
                        {NAV_LINKS.map(({ label, href }) => {
                            const active = isActive(href)
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={`relative px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${active
                                        ? 'text-white bg-white/[0.08]'
                                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {label}
                                    {active && (
                                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
                                    )}
                                </Link>
                            )
                        })}
                    </div>
                    {/* Fade right edge for mobile overflow */}
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-neutral-950/80 to-transparent pointer-events-none" />
                </nav>
            </div>
        </header>
    )
}
