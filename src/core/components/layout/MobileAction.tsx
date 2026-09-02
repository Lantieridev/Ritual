'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * La acción principal de una pantalla en mobile. El prototipo la fija sobre
 * el talón de navegación ("la acción crítica del día vive fija sobre el
 * talón, en rojo, a 58px"), pero el talón vive en el layout y la acción la
 * decide cada página — este contexto los conecta sin que el layout tenga que
 * saber nada de las páginas.
 */
export interface MobileHeroActionSpec {
    label: string
    href?: string
    onClick?: () => void
    altLabel?: string
    altHref?: string
    altOnClick?: () => void
}

interface MobileActionContextValue {
    action: MobileHeroActionSpec | null
    setAction: (action: MobileHeroActionSpec | null) => void
}

const MobileActionContext = createContext<MobileActionContextValue | null>(null)

export function MobileActionProvider({ children }: { children: ReactNode }) {
    const [action, setAction] = useState<MobileHeroActionSpec | null>(null)

    // El aire inferior de la página (`--ritual-mobile-clearance` en
    // globals.css) depende de cuánto mide la pila fija de abajo: se expone en
    // <html> para que Footer y PageShell lo resuelvan con CSS, sin leer este
    // contexto.
    useEffect(() => {
        const root = document.documentElement
        if (!action) {
            delete root.dataset.mobileAction
            return
        }
        root.dataset.mobileAction = action.altLabel ? 'alt' : 'hero'
        return () => {
            delete root.dataset.mobileAction
        }
    }, [action])

    const value = useMemo(() => ({ action, setAction }), [action])

    return <MobileActionContext.Provider value={value}>{children}</MobileActionContext.Provider>
}

/** La acción registrada por la página actual, o null si no hay ninguna. */
export function useMobileHeroAction(): MobileHeroActionSpec | null {
    return useContext(MobileActionContext)?.action ?? null
}

/**
 * Registra la acción principal de la pantalla mientras está montado. Fuera de
 * un `MobileActionProvider` (tests, Storybook) no hace nada.
 */
export function MobileHeroAction({ label, href, onClick, altLabel, altHref, altOnClick }: MobileHeroActionSpec) {
    const setAction = useContext(MobileActionContext)?.setAction

    useEffect(() => {
        if (!setAction) return
        setAction({ label, href, onClick, altLabel, altHref, altOnClick })
        return () => setAction(null)
    }, [setAction, label, href, onClick, altLabel, altHref, altOnClick])

    return null
}
