'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { routes } from '@/src/core/lib/routes'
import type { User } from '@supabase/supabase-js'
import { useMobileHeroAction, type MobileHeroActionSpec } from './MobileAction'

interface MobileTabBarProps {
    user?: User | null
    /**
     * Acción principal fija sobre el talón. Normalmente no se pasa: la
     * registra la página con `<MobileHeroAction>` (ver MobileAction.tsx).
     */
    heroAction?: MobileHeroActionSpec
    /**
     * La banda de "Tu entrada de hoy" que el diseño pone sobre el talón en
     * Buscar, Archivo y Vos cuando hay un show esa noche. Todavía ninguna
     * página la conecta: la estructura queda lista para ese paso (#82).
     */
    bandaAction?: {
        subtitle: string
        title: string
        actionLabel: string
        onClick?: () => void
        href?: string
    }
}

/**
 * Talón de navegación mobile — cuatro palabras, sin íconos. Portado del
 * prototipo de Claude Design (Ritual Mobile.dc.html, bloque `navTabs`): el
 * sistema es tipográfico, así que la pestaña activa se distingue por la fuente
 * (Anton 19px en hueso) contra las inactivas (Bebas 17px en gris), más un
 * filete rojo de 2px al ras del borde superior. Fila de 52px + 16px de área
 * segura.
 *
 * Colores: activo / inactivo / filete son tokens existentes (bone, gray-text,
 * red). Fondo y borde son propios del mobile (`--color-ritual-mobile-nav-*`).
 * La banda de "Tu entrada de hoy" usa `--color-ritual-mobile-banda-*` por la
 * misma razón: no coinciden exacto con ningún token de escritorio.
 *
 * "Colección" va como "Archivo": entra en 375px y es la palabra del handoff.
 * Solo visible por debajo de `md`; desde ahí el Navbar de escritorio manda.
 */
const TABS = [
    { key: 'hoy', label: 'Hoy', href: routes.home },
    { key: 'buscar', label: 'Buscar', href: routes.events.search },
    { key: 'archivo', label: 'Archivo', href: routes.collection },
] as const

const TAB_CLASS = 'relative flex-1 flex items-center justify-center h-[52px]'

function tabLabelClass(active: boolean) {
    return active
        ? 'font-display text-[19px] tracking-[0.03em] uppercase leading-none text-ritual-bone'
        : 'font-figure text-[17px] tracking-[0.14em] uppercase leading-none text-ritual-gray-text'
}

function TabMark({ active }: { active: boolean }) {
    return (
        <span
            aria-hidden
            className={`absolute -top-px inset-x-0 h-[2px] ${active ? 'bg-ritual-red' : 'bg-transparent'}`}
        />
    )
}

export function MobileTabBar({ user, heroAction, bandaAction }: MobileTabBarProps) {
    const pathname = usePathname()
    const registeredAction = useMobileHeroAction()
    const hero = heroAction ?? registeredAction ?? undefined
    const vosHref = user ? routes.profile : routes.login

    function isActive(href: string) {
        if (href === '/') return pathname === '/'
        return pathname.startsWith(href)
    }

    const tabs = [...TABS, { key: 'vos', label: 'Vos', href: vosHref }]

    const bandaClassName = 'relative flex w-full items-center gap-[12px] bg-ritual-mobile-banda-bg border-t border-ritual-mobile-banda-border border-l-[3px] border-l-ritual-red px-[16px] py-[10px] pl-[13px] min-h-[60px] text-left'
    const bandaContent = bandaAction ? (
        <>
            <div className="flex-1 min-w-0">
                <div className="font-label text-[9px] tracking-[0.24em] text-ritual-gray-mid-2 uppercase">
                    {bandaAction.subtitle}
                </div>
                <div className="font-subtitle font-black text-[21px] uppercase leading-none mt-[3px]">
                    {bandaAction.title}
                </div>
            </div>
            <div className="bg-ritual-red text-ritual-panel font-figure text-[16px] tracking-[0.1em] uppercase px-[14px] py-[9px]">
                {bandaAction.actionLabel}
            </div>
        </>
    ) : null

    const heroClassName = 'flex w-full items-center justify-center gap-[10px] h-[58px] bg-ritual-red text-ritual-panel font-display text-[22px] tracking-[0.05em] uppercase'
    const heroAltClassName = 'flex w-full items-center justify-center h-[50px] mt-[8px] font-label text-[10px] tracking-[0.2em] text-ritual-gray-text uppercase'

    return (
        <nav
            aria-label="Navegación principal"
            className="md:hidden fixed inset-x-0 bottom-0 z-50 flex flex-col"
        >
            {bandaAction && !hero && (
                bandaAction.href ? (
                    <Link href={bandaAction.href} className={bandaClassName}>
                        {bandaContent}
                    </Link>
                ) : (
                    <button type="button" onClick={bandaAction.onClick} className={bandaClassName}>
                        {bandaContent}
                    </button>
                )
            )}
            {hero && !bandaAction && (
                <div className="pt-[22px] px-[14px] pb-[10px] bg-gradient-to-t from-ritual-panel from-[58%] to-transparent">
                    {hero.href ? (
                        <Link href={hero.href} className={heroClassName}>
                            {hero.label}
                        </Link>
                    ) : (
                        <button type="button" onClick={hero.onClick} className={heroClassName}>
                            {hero.label}
                        </button>
                    )}
                    {hero.altLabel && (
                        hero.altHref ? (
                            <Link href={hero.altHref} className={heroAltClassName}>
                                {hero.altLabel}
                            </Link>
                        ) : (
                            <button type="button" onClick={hero.altOnClick} className={heroAltClassName}>
                                {hero.altLabel}
                            </button>
                        )
                    )}
                </div>
            )}
            <div className="relative flex bg-ritual-mobile-nav-bg border-t border-ritual-mobile-nav-border pb-[16px]">
                {tabs.map(({ key, label, href }) => {
                    const active = isActive(href)
                    return (
                        <Link
                            key={key}
                            href={href}
                            aria-current={active ? 'page' : undefined}
                            className={TAB_CLASS}
                        >
                            <TabMark active={active} />
                            <span className={tabLabelClass(active)}>{label}</span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
