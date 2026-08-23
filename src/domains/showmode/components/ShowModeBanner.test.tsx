// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShowModeBanner } from '@/src/domains/showmode/components/ShowModeBanner'
import { resolveShowModeWindow, describeShowModePhase } from '@/src/domains/showmode/window'
import { DEFAULT_SHOW_MODE_PREFERENCES } from '@/src/domains/showmode/preferences'

const NOW = new Date('2026-05-10T15:00:00Z')

function renderFor(startDate: string, endDate?: string | null) {
  const window = resolveShowModeWindow(
    { startDate, endDate },
    DEFAULT_SHOW_MODE_PREFERENCES,
    NOW
  )
  return render(<ShowModeBanner window={window} phaseLabel={describeShowModePhase(window)} />)
}

describe('ShowModeBanner', () => {
  it('anuncia el modo activo y cuánto falta durante la ventana previa', () => {
    renderFor('2026-05-13')
    expect(screen.getByTestId('show-mode-banner')).toBeInTheDocument()
    expect(screen.getByText('Modo recital activo')).toBeInTheDocument()
    expect(screen.getByText('Faltan 3 días')).toBeInTheDocument()
  })

  it('cambia el mensaje el día del show', () => {
    renderFor('2026-05-10')
    expect(screen.getByText('Es la noche')).toBeInTheDocument()
    expect(screen.getByText('Es hoy')).toBeInTheDocument()
  })

  it('sigue visible después del show, avisando que la ventana no cerró', () => {
    renderFor('2026-05-09')
    expect(screen.getByText('Ventana abierta')).toBeInTheDocument()
    expect(screen.getByText(/Todavía podés cargar lo que quedó pendiente/)).toBeInTheDocument()
  })

  it(
    'no renderiza nada para un show lejano: la idea del issue es que la app se active para un ' +
      'show puntual, no que grite en todas las fichas',
    () => {
      const { container } = renderFor('2026-08-30')
      expect(container).toBeEmptyDOMElement()
    }
  )

  it('no renderiza nada para un show viejo, con la ventana ya cerrada', () => {
    const { container } = renderFor('2026-01-01')
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra la ventana configurada y linkea a los ajustes para cambiarla', () => {
    renderFor('2026-05-13')
    expect(screen.getByText(/7d antes · 2d después/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cambiar' })).toHaveAttribute('href', '/modo-recital')
  })

  it('dice "Está pasando" en un festival multi-día en curso', () => {
    renderFor('2026-05-08', '2026-05-12')
    expect(screen.getByText('Está pasando')).toBeInTheDocument()
  })
})
