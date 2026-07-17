// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomSheetItem } from '@/src/core/components/ui/BottomSheetItem'

describe('BottomSheetItem', () => {
  describe('variante to (link)', () => {
    it('renderiza un anchor con el href dado', () => {
      render(<BottomSheetItem to="/events/nuevo" label="Cargar recital" />)
      expect(screen.getByRole('link', { name: 'Cargar recital' })).toHaveAttribute(
        'href',
        '/events/nuevo'
      )
    })
  })

  describe('variante onClick (button)', () => {
    it('renderiza un button que dispara onClick al activarse', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<BottomSheetItem onClick={onClick} label="Cerrar sesión" />)

      const button = screen.getByRole('button', { name: 'Cerrar sesión' })
      await user.click(button)

      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('tono', () => {
    it('tone="acento" aplica la clase de texto acento', () => {
      render(<BottomSheetItem onClick={vi.fn()} label="Comprar" tone="acento" />)
      expect(screen.getByText('Comprar')).toHaveClass('text-ritual-red')
    })

    it('tone="apagado" aplica la clase de texto apagado', () => {
      render(<BottomSheetItem onClick={vi.fn()} label="Cancelar" tone="apagado" />)
      expect(screen.getByText('Cancelar')).toHaveClass('text-ritual-gray-text')
    })

    it('sin tone aplica la clase por defecto (bone)', () => {
      render(<BottomSheetItem onClick={vi.fn()} label="Ver detalle" />)
      expect(screen.getByText('Ver detalle')).toHaveClass('text-ritual-bone')
    })
  })

  describe('hint', () => {
    it('renderiza el hint cuando se pasa', () => {
      render(<BottomSheetItem onClick={vi.fn()} label="Comprar" hint="Desde $5000" />)
      expect(screen.getByText('Desde $5000')).toBeInTheDocument()
    })

    it('no renderiza ningún hint cuando no se pasa', () => {
      render(<BottomSheetItem onClick={vi.fn()} label="Comprar" />)
      expect(screen.queryByText(/Desde/)).not.toBeInTheDocument()
    })
  })

  describe('target size y separador', () => {
    it('declara un alto mínimo de 56px', () => {
      const { container } = render(<BottomSheetItem onClick={vi.fn()} label="Comprar" />)
      expect(container.firstElementChild).toHaveClass('min-h-[56px]')
    })

    it('declara la clase del divisor de fila', () => {
      const { container } = render(<BottomSheetItem onClick={vi.fn()} label="Comprar" />)
      expect(container.firstElementChild).toHaveClass('border-ritual-mobile-sheet-divider')
    })
  })

  it('el glifo → es decorativo (aria-hidden)', () => {
    render(<BottomSheetItem onClick={vi.fn()} label="Comprar" />)
    expect(screen.getByText('→')).toHaveAttribute('aria-hidden', 'true')
  })
})
