'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { signout } from '@/src/core/auth/actions'
import type { User } from '@supabase/supabase-js'
import { routes } from '@/src/core/lib/routes'

interface ProfileDropdownProps {
    user: User
}

export function ProfileDropdown({ user }: ProfileDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const menuItems = [
        { label: 'Mi Perfil', href: routes.profile, border: true },
        { label: 'Wishlist', href: routes.wishlist },
        { label: 'Mis Gastos', href: routes.expenses.list },
        { label: 'Mis Artistas', href: routes.artists.list },
        { label: 'Mis Sedes', href: routes.venues.list, border: true },
    ]

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
            >
                <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center shadow-inner">
                    <span className="text-[10px] font-bold text-white uppercase leading-none">
                        {user.email?.[0] ?? 'U'}
                    </span>
                </div>
                <span className="text-sm font-medium text-zinc-300 hidden md:block max-w-[100px] truncate">
                    {user.email?.split('@')[0]}
                </span>
                <svg className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-neutral-900 shadow-2xl py-1 z-50 origin-top-right animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-4 py-3 border-b border-white/5 mb-1">
                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Conectado como</p>
                        <p className="text-sm text-white truncate font-medium">{user.email}</p>
                    </div>

                    {menuItems.map((item, idx) => (
                        <div key={item.href}>
                            <Link
                                href={item.href}
                                onClick={() => setIsOpen(false)}
                                className="block px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
                            >
                                {item.label}
                            </Link>
                            {/* Add border if specified and not last item */}
                            {item.border && <div className="h-px bg-white/5 my-1 mx-2" />}
                        </div>
                    ))}

                    <div className="pt-1 mt-1 border-t border-white/5 bg-neutral-950/30 rounded-b-xl">
                        <button
                            onClick={() => signout()}
                            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 hover:text-red-300 transition-colors"
                        >
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
