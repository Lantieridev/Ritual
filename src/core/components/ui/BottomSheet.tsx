'use client'

import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'

interface BottomSheetProps {
    open: boolean
    onClose: () => void
    /** Anton 30px uppercase; también es el nombre accesible del diálogo (aria-labelledby). */
    title: string
    /** Space Mono 9px .18em uppercase. Opcional: no todo sheet necesita subtítulo. */
    subtitle?: string
    children: ReactNode
    className?: string
}

/**
 * Nodos que participan de la trampa de foco. Se re-consulta en cada Tab
 * (no se memoiza al abrir) porque los hijos son ReactNode arbitrario y
 * pueden cambiar mientras el sheet está abierto.
 */
const FOCUSABLE =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Shell de bottom sheet modal — velo + panel anclado abajo, sin portal
 * (mismo patrón que PhotoGallery.tsx, el único modal real del repo).
 * Controlado: el consumidor maneja `open`/`onClose`, igual que TicketPass en
 * HomeHero.tsx.
 */
export function BottomSheet({ open, onClose, title, subtitle, children, className = '' }: BottomSheetProps) {
    const panelRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<Element | null>(null)
    const titleId = useId()
    const subtitleId = useId()

    // Ref para la última onClose: el efecto de abajo sólo debe reaccionar a
    // transiciones reales de `open`, no a que el consumidor pase una nueva
    // referencia de función en cada render (ej. onClose={() => setOpen(false)}
    // inline). Si `onClose` estuviera en las deps del efecto principal, un
    // re-render ajeno del consumidor mientras el sheet está abierto re-abriría
    // el efecto: recapturaría el trigger sobre el elemento que tenga el foco
    // en ESE momento (no el original) y volvería a robar el foco hacia el
    // panel sin que el usuario hiciera nada.
    const onCloseRef = useRef(onClose)
    useEffect(() => {
        onCloseRef.current = onClose
    }, [onClose])

    useEffect(() => {
        if (!open) return

        triggerRef.current = document.activeElement
        panelRef.current?.focus()

        function handleKeyDown(e: globalThis.KeyboardEvent) {
            if (e.key === 'Escape') onCloseRef.current()
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            const trigger = triggerRef.current
            if (trigger instanceof HTMLElement && trigger.isConnected) {
                trigger.focus()
            }
        }
    }, [open])

    if (!open) return null

    function handlePanelKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
        if (e.key !== 'Tab') return
        const panel = panelRef.current
        if (!panel) return

        // El handle de cerrar participa del ciclo de Tab junto con el
        // contenido — queda primero en el orden del DOM, así que Tab desde
        // el panel llega naturalmente a él. Si sólo el contenido formara el
        // límite del trap, un Tab que ya dio la vuelta una vez deja al
        // handle inalcanzable por teclado por el resto de esa apertura
        // (Shift+Tab desde el primer ítem saltaría directo al último).
        const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (nodes.length === 0) {
            e.preventDefault()
            panel?.focus()
            return
        }

        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        const active = document.activeElement

        if (e.shiftKey && (active === first || active === panel)) {
            e.preventDefault()
            last.focus()
        } else if (!e.shiftKey && active === last) {
            e.preventDefault()
            first.focus()
        }
    }

    return (
        <>
            {/* Velo y panel son hermanos, no anidados (sin portal) — un click
                en el panel nunca puede burbujear hasta el onClick del velo,
                así que no hace falta stopPropagation acá. */}
            <div
                onClick={onClose}
                className="ritual-sheet-veil fixed inset-0 z-[88] bg-ritual-mobile-sheet-veil"
            />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={subtitle ? subtitleId : undefined}
                tabIndex={-1}
                onKeyDown={handlePanelKeyDown}
                className={`ritual-sheet-up fixed inset-x-0 bottom-0 z-[90] flex max-h-[88%] flex-col border-t-2 border-ritual-red bg-ritual-mobile-nav-bg ${className}`}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Cerrar"
                    className="flex justify-center pt-[11px] pb-[10px]"
                >
                    <span aria-hidden="true" className="h-[3px] w-[44px] bg-ritual-gray-muted" />
                </button>
                <div ref={contentRef} className="overflow-y-auto px-5 pb-[26px]">
                    <h2 id={titleId} className="font-display text-[30px] uppercase leading-[0.92] text-ritual-bone">
                        {title}
                    </h2>
                    {subtitle && (
                        <p
                            id={subtitleId}
                            className="mt-1.5 font-label text-[9px] uppercase tracking-[0.18em] text-ritual-gray-mid-2"
                        >
                            {subtitle}
                        </p>
                    )}
                    {children}
                </div>
            </div>
        </>
    )
}
