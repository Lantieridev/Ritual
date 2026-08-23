// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockToPng = vi.fn()

vi.mock('html-to-image', () => ({
  toPng: (...args: unknown[]) => mockToPng(...args),
}))

import { MemoryCard } from '@/src/domains/showmode/components/MemoryCard'
import type { MemoryCardData } from '@/src/domains/showmode/memory-card'

const card: MemoryCardData = {
  serial: 'RTL-4F2A-91C7',
  title: 'Ritual en el Obelisco',
  dateLabel: '10 de mayo de 2026',
  venueLabel: 'Obelisco, Buenos Aires',
  lineup: ['Los Redondos', 'Soporte'],
  rating: 5,
  reviewExcerpt: 'La mejor noche del año.',
  totalSpent: 23000,
  categories: [
    { category: 'Entrada', icon: '🎟️', total: 15000 },
    { category: 'Comida y bebida', icon: '🍔', total: 8000 },
  ],
  choripanLine: 'esto son 4,6 choripanes',
  inflationLine: 'Hoy serían $30.000',
  weather: { emoji: '☀️', temperatureC: 17, description: 'Despejado' },
}

function renderCard(overrides: Partial<React.ComponentProps<typeof MemoryCard>> = {}) {
  return render(<MemoryCard card={card} pendingLabels={[]} {...overrides} />)
}

describe('MemoryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToPng.mockResolvedValue('data:image/png;base64,AAAA')
  })

  it('muestra los datos esenciales del show', () => {
    renderCard()
    expect(screen.getByText('Ritual en el Obelisco')).toBeInTheDocument()
    expect(screen.getByText(/10 de mayo de 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Obelisco, Buenos Aires/)).toBeInTheDocument()
  })

  it('compone las comparaciones de gasto del issue #7', () => {
    renderCard()
    expect(screen.getByText('$23.000')).toBeInTheDocument()
    expect(screen.getByText(/esto son 4,6 choripanes · Hoy serían \$30\.000/)).toBeInTheDocument()
    expect(screen.getByText(/Entrada/)).toBeInTheDocument()
    expect(screen.getByText('$15.000')).toBeInTheDocument()
  })

  it('compone el clima del issue #8', () => {
    renderCard()
    expect(screen.getByText('17°C')).toBeInTheDocument()
    expect(screen.getByText('Despejado')).toBeInTheDocument()
  })

  it('sigue dibujando la tarjeta cuando no hay clima, en vez de esconderla', () => {
    renderCard({ card: { ...card, weather: null } })
    expect(screen.getByText('Sin registro')).toBeInTheDocument()
    expect(screen.getByText('Ritual en el Obelisco')).toBeInTheDocument()
  })

  it('muestra el puntaje y el serial del stub', () => {
    renderCard()
    expect(screen.getByText('5/5')).toBeInTheDocument()
    expect(screen.getByText('RTL-4F2A-91C7')).toBeInTheDocument()
  })

  it('descarga la tarjeta como imagen', async () => {
    const user = userEvent.setup()
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    renderCard()
    await user.click(screen.getByRole('button', { name: /Descargar recuerdo/ }))

    await waitFor(() => expect(mockToPng).toHaveBeenCalledTimes(1))
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('excluye del render los controles marcados con data-no-export', async () => {
    const user = userEvent.setup()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderCard()
    await user.click(screen.getByRole('button', { name: /Descargar recuerdo/ }))

    await waitFor(() => expect(mockToPng).toHaveBeenCalled())
    const options = mockToPng.mock.calls[0][1] as { filter: (node: Node) => boolean }

    const excluded = document.createElement('div')
    excluded.dataset.noExport = 'true'
    expect(options.filter(excluded)).toBe(false)
    expect(options.filter(document.createElement('div'))).toBe(true)
  })

  it('avisa el error sin romper la página si la exportación falla', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockToPng.mockRejectedValue(new Error('canvas tainted'))

    renderCard()
    await user.click(screen.getByRole('button', { name: /Descargar recuerdo/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo descargar la imagen')
  })

  it('deja claro que es un recuerdo personal, no una función social', () => {
    renderCard()
    expect(screen.getByText(/No se publica en ningún lado/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /compartir/i })).not.toBeInTheDocument()
  })

  it('avisa qué falta cuando el show está incompleto, pero deja descargar igual', () => {
    renderCard({ pendingLabels: ['Escribir la reseña'] })
    expect(screen.getByText(/Todavía falta escribir la reseña/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Descargar recuerdo/ })).toBeEnabled()
  })
})
