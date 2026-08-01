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

    useEffect(() => {
        if (!isOpen) return
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') setIsOpen(false)
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen])

    // Navegación de contenido vive en la Navbar principal — este menú es
    // solo para acciones de cuenta.
    const menuItems = [
        { label: 'Mi Perfil', href: routes.profile, border: true },
    ]

    return (
        <div className="relative" ref={menuRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                className="flex items-center gap-2 px-2 py-1.5 bg-ritual-surface hover:bg-ritual-surface-high transition-colors border border-ritual-border-subtle"
            >
                <div className="w-6 h-6 rounded-full bg-ritual-red flex items-center justify-center">
                    <span className="font-figure text-xs text-ritual-bone uppercase leading-none">
                        {user.email?.[0] ?? 'U'}
                    </span>
                </div>
                <span className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-light hidden md:block max-w-[100px] truncate">
                    {user.email?.split('@')[0]}
                </span>
                <svg className={`w-4 h-4 text-ritual-gray-text transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-56 border border-ritual-border bg-ritual-panel-2 shadow-2xl py-1 z-50 origin-top-right animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-4 py-3 border-b border-ritual-border-subtle mb-1">
                        <p className="font-label text-[9px] text-ritual-gray-text uppercase tracking-[0.14em]">Conectado como</p>
                        <p className="font-body text-sm text-ritual-bone truncate">{user.email}</p>
                    </div>

                    {menuItems.map((item) => (
                        <div key={item.href}>
                            <Link
                                href={item.href}
                                role="menuitem"
                                onClick={() => setIsOpen(false)}
                                className="block px-4 py-2 font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-text hover:bg-ritual-surface hover:text-ritual-bone transition-colors"
                            >
                                {item.label}
                            </Link>
                            {/* Add border if specified and not last item */}
                            {item.border && <div className="h-px bg-ritual-border-subtle my-1 mx-2" />}
                        </div>
                    ))}

                    <div className="pt-1 mt-1 border-t border-ritual-border-subtle bg-ritual-bg/30">
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => signout()}
                            className="w-full text-left px-4 py-2 font-label text-[10px] tracking-[0.1em] uppercase text-ritual-red-hover hover:bg-ritual-surface hover:text-ritual-red-hover transition-colors"
                        >
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
