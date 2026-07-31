'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { routes } from '@/src/core/lib/routes'

import { ProfileDropdown } from './ProfileDropdown'

// Artistas y Sedes son el catálogo compartido: cualquiera puede navegarlo,
// con o sin sesión. Wishlist y Gastos son datos propios de una cuenta —
// mostrarlos a un visitante sin sesión solo lleva a una pantalla vacía o a
// un aviso de "iniciá sesión", así que quedan aparte y solo se agregan al
// menú cuando hay un usuario logueado.
const PUBLIC_NAV_LINKS = [
    { label: 'Inicio', href: routes.home },
    { label: 'Buscar', href: routes.events.search },
    { label: 'Artistas', href: routes.artists.list },
    { label: 'Sedes', href: routes.venues.list },
    { label: 'Festivales', href: routes.festivals.list },
    { label: 'Stats', href: routes.stats },
]

const AUTHENTICATED_NAV_LINKS = [
    { label: 'Wishlist', href: routes.wishlist },
    { label: 'Gastos', href: routes.expenses.list },
]

/**
 * Navbar global sticky con efecto backdrop-blur y active link indicator.
 * Se renderiza en app/layout.tsx y persiste en toda la navegación.
 */
import type { User } from '@supabase/supabase-js'

interface NavbarProps {
    user?: User | null
}

export function Navbar({ user }: NavbarProps) {
    const pathname = usePathname()
    const navLinks = user ? [...PUBLIC_NAV_LINKS, ...AUTHENTICATED_NAV_LINKS] : PUBLIC_NAV_LINKS

    function isActive(href: string) {
        if (href === '/') return pathname === '/'
        return pathname.startsWith(href)
    }

    return (
        <header className="fixed top-0 inset-x-0 z-50 h-16 border-b border-ritual-border-subtle bg-ritual-panel/90 backdrop-blur-md">
            <div className="max-w-7xl mx-auto h-full px-6 md:px-8 flex items-center justify-between gap-8">
                {/* Logo */}
                <Link
                    href={routes.home}
                    className="font-display text-xl tracking-[0.06em] uppercase text-ritual-bone hover:text-ritual-gray-light-3 transition-colors shrink-0"
                >
                    RITU<span className="text-ritual-red">AL</span>
                </Link>

                {/* Nav links — scrollable on mobile with fade */}
                <nav className="relative flex-1 overflow-hidden">
                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pr-8">
                        {navLinks.map(({ label, href }) => {
                            const active = isActive(href)
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={`relative px-3 py-1.5 font-label text-[10px] tracking-[0.16em] uppercase transition-colors whitespace-nowrap ${active
                                        ? 'text-white bg-ritual-surface-high'
                                        : 'text-ritual-gray-text hover:text-white hover:bg-ritual-surface'
                                        }`}
                                >
                                    {label}
                                    {active && (
                                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-ritual-red" />
                                    )}
                                </Link>
                            )
                        })}
                    </div>
                    {/* Fade right edge for mobile overflow */}
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-ritual-panel to-transparent pointer-events-none" />
                </nav>

                {/* Auth Section */}
                <div className="shrink-0 flex items-center gap-4">
                    {user ? (
                        <ProfileDropdown user={user} />
                    ) : (
                        <Link
                            href={routes.login}
                            className="font-figure text-base tracking-wide bg-ritual-red text-ritual-panel px-4 py-2 hover:bg-ritual-red-hover transition-colors"
                        >
                            Ingresar
                        </Link>
                    )}
                </div>
            </div>
        </header>
    )
}
