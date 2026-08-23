// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PendingShowPrompt } from '@/src/domains/showmode/components/PendingShowPrompt'
import { computePendingForShow } from '@/src/domains/showmode/pending'

describe('PendingShowPrompt', () => {
  it('junta todo lo pendiente en un solo aviso, no en avisos sueltos', () => {
    const pending = computePendingForShow({
      attendanceStatus: 'went',
      expenseCount: 0,
      rating: null,
      review: null,
    })
    render(<PendingShowPrompt pending={pending} />)

    expect(screen.getAllByTestId('pending-show-prompt')).toHaveLength(1)
    expect(screen.getByText('Cargar los gastos de esa noche')).toBeInTheDocument()
    expect(screen.getByText('Puntuar el show')).toBeInTheDocument()
    expect(screen.getByText('Escribir la reseña')).toBeInTheDocument()
  })

  it('no renderiza nada cuando no queda nada pendiente', () => {
    const { container } = render(<PendingShowPrompt pending={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('deja explícito que el aviso por mail/push depende del issue #6, todavía sin implementar', () => {
    render(<PendingShowPrompt pending={[{ kind: 'rating', label: 'Puntuar el show' }]} />)

    expect(screen.getByText(/depende del sistema de notificaciones/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'issue #6' })).toHaveAttribute(
      'href',
      'https://github.com/Lantieridev/Ritual/issues/6'
    )
  })
})
