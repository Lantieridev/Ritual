import Link from 'next/link'
import { routes } from '@/src/core/lib/routes'
import type { ShowModeWindow } from '@/src/domains/showmode/window'

interface ShowModeBannerProps {
  window: ShowModeWindow
  phaseLabel: string | null
}

const PHASE_COPY: Record<'before' | 'during' | 'after', string> = {
  before: 'Modo recital activo',
  during: 'Es la noche',
  after: 'Ventana abierta',
}

const PHASE_HINT: Record<'before' | 'during' | 'after', string> = {
  before: 'La app se puso en modo show: checklist, clima y carga rápida de gastos, todo acá abajo.',
  during: 'Andá tranquilo. Los gastos y las notas los cargás después, la ventana sigue abierta.',
  after: 'Todavía podés cargar lo que quedó pendiente de esa noche.',
}

/**
 * La banda que anuncia que el modo recital está activo (issue #9).
 *
 * No renderiza nada fuera de la ventana: un show dentro de tres meses o uno
 * de hace un año son la ficha de evento de siempre, sin capa encima. Esa es
 * justamente la idea del issue — que la app "se active" para acompañar un
 * show puntual, no que grite en todas las fichas.
 */
export function ShowModeBanner({ window, phaseLabel }: ShowModeBannerProps) {
  if (!window.isActive) return null
  const phase = window.phase as 'before' | 'during' | 'after'

  return (
    <section
      data-testid="show-mode-banner"
      className="border-l-[3px] border-ritual-red bg-ritual-surface px-5 py-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-red-hover">
          {PHASE_COPY[phase]}
        </p>
        {phaseLabel && (
          <p className="font-subtitle font-black text-xl uppercase text-ritual-bone">{phaseLabel}</p>
        )}
      </div>
      <p className="font-body text-sm text-ritual-gray-text mt-1.5">{PHASE_HINT[phase]}</p>
      <p className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-text mt-3">
        Ventana: {window.preferences.daysBefore}d antes · {window.preferences.daysAfter}d después ·{' '}
        <Link
          href={routes.showMode}
          className="text-ritual-gray-light-3 hover:text-ritual-bone transition-colors underline underline-offset-4"
        >
          Cambiar
        </Link>
      </p>
    </section>
  )
}
