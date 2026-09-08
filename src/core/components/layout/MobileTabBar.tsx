'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { routes } from '@/src/core/lib/routes'
import type { User } from '@supabase/supabase-js'
import { useMobileHeroAction, type MobileHeroActionSpec, type MobileBandaLink } from './MobileAction'

interface MobileTabBarProps {
    user?: User | null
    /**
     * Acción principal fija sobre el talón. Normalmente no se pasa: la
     * registra la página con `<MobileHeroAction>` (ver MobileAction.tsx).
     */
    heroAction?: MobileHeroActionSpec
    /**
     * La banda de "Tu entrada de hoy" que el diseño pone sobre el talón en
     * Buscar, Colección y Vos cuando hay un show esa noche — la resuelve el
     * layout raíz (`loadBandaAction`, server-side) y gana precedencia sobre
     * cualquier acción de página en esas rutas (issue #82).
     */
    bandaAction?: MobileBandaLink
}

/**
 * Rutas donde puede aparecer la banda de "Tu entrada de hoy" (issue #82).
 * Home NO entra: ahí la acción principal la decide siempre la página con
 * `<MobileHeroAction>`.
 */
export const BANDA_ROUTES = [routes.events.search, routes.collection, routes.profile] as const

/**
 * `startsWith` a secas matchearía un prefijo suelto como `/buscar-algo`
 * contra `/buscar` — se exige el separador `/` (o la ruta exacta) para que
 * eso no pase.
 */
export function isBandaRoute(pathname: string): boolean {
    return BANDA_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
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

    // La banda gana precedencia sobre la acción de página en sus rutas: a lo
    // sumo una acción primaria a la vez sobre el talón (issue #82).
    const showBanda = Boolean(bandaAction) && isBandaRoute(pathname)
    const showHero = Boolean(hero) && !showBanda

    // El aire de abajo (--ritual-mobile-clearance) sube 154px mientras la
    // banda está en pantalla. No pasa por MobileActionProvider/data-mobile-
    // action porque la banda no la registra una página cliente: la resuelve
    // el layout raíz del lado del servidor.
    useEffect(() => {
        const root = document.documentElement
        if (!showBanda) {
            delete root.dataset.mobileBanda
            return
        }
        root.dataset.mobileBanda = 'true'
        return () => {
            delete root.dataset.mobileBanda
        }
    }, [showBanda])

    function isActive(href: string) {
        if (href === '/') return pathname === '/'
        return pathname.startsWith(href)
    }

    const tabs = [...TABS, { key: 'vos', label: 'Vos', href: vosHref }]

    const bandaClassName = 'relative flex w-full items-center gap-[12px] bg-ritual-mobile-banda-bg border-t border-ritual-mobile-banda-border border-l-[3px] border-l-ritual-red px-[16px] py-[10px] pl-[13px] min-h-[60px] text-left'
    const heroClassName = 'flex w-full items-center justify-center gap-[10px] h-[58px] bg-ritual-red text-ritual-panel font-display text-[22px] tracking-[0.05em] uppercase'
    const heroAltClassName = 'flex w-full items-center justify-center h-[50px] mt-[8px] font-label text-[10px] tracking-[0.2em] text-ritual-gray-text uppercase'

    return (
        <nav
            aria-label="Navegación principal"
            className="md:hidden fixed inset-x-0 bottom-0 z-50 flex flex-col"
        >
            {showBanda && bandaAction && (
                // La banda la resuelve un Server Component y sólo puede
                // llevar datos serializables: siempre un <Link>, nunca un
                // botón con onClick (R1-004).
                <Link href={bandaAction.href} className={bandaClassName} data-mobile-primary>
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
                </Link>
            )}
            {showHero && hero && (
                <div
                    className="pt-[22px] px-[14px] pb-[10px] bg-gradient-to-t from-ritual-panel from-[58%] to-transparent"
                    data-mobile-primary
                >
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
