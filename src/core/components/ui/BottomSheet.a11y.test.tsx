// @vitest-environment jsdom
import { useState } from 'react'
import type { ReactNode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomSheet } from '@/src/core/components/ui/BottomSheet'

/** Sheet con dos filas enfocables — el caso general de foco/dismiss. */
function TwoItemSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Opciones" subtitle="Elegí una">
      <button type="button">Uno</button>
      <button type="button">Dos</button>
    </BottomSheet>
  )
}

/** Sheet vacío — para el caso "no hay ningún elemento enfocable". */
function EmptySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Opciones">
      <p>Nada por acá.</p>
    </BottomSheet>
  )
}

/** Trigger real + sheet controlado, como lo usaría un consumidor. */
function Harness({ children }: { children: (onClose: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      {open && children(() => setOpen(false))}
    </>
  )
}

function TwoItemHarness() {
  return <Harness>{(onClose) => <TwoItemSheetOpen onClose={onClose} />}</Harness>
}

function TwoItemSheetOpen({ onClose }: { onClose: () => void }) {
  return <TwoItemSheet open onClose={onClose} />
}

/** Trigger que se puede desmontar mientras el sheet sigue abierto. */
function UnmountingTriggerHarness() {
  const [open, setOpen] = useState(false)
  const [showTrigger, setShowTrigger] = useState(true)
  return (
    <>
      {showTrigger && (
        <button type="button" onClick={() => setOpen(true)}>
          Abrir
        </button>
      )}
      <button type="button" onClick={() => setShowTrigger(false)}>
        Quitar trigger
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Opciones">
        <button type="button">Uno</button>
      </BottomSheet>
    </>
  )
}

describe('BottomSheet', () => {
  it('no renderiza contenido ni backdrop cuando open=false', () => {
    render(<TwoItemSheet open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Opciones')).not.toBeInTheDocument()
  })

  it('renderiza el sheet con role=dialog, aria-modal y aria-labelledby apuntando al título', () => {
    render(<TwoItemSheet open onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    const titleEl = document.getElementById(labelledBy!)
    expect(titleEl).toHaveTextContent('Opciones')
  })

  it('aria-describedby apunta al subtítulo cuando hay uno, y no se declara cuando no hay', () => {
    const { rerender } = render(<TwoItemSheet open onClose={vi.fn()} />)

    const describedBy = screen.getByRole('dialog').getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)).toHaveTextContent('Elegí una')

    rerender(<EmptySheet open onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby')
  })

  describe('vías de cierre', () => {
    it('Escape llama a onClose una vez', () => {
      const onClose = vi.fn()
      render(<TwoItemSheet open onClose={onClose} />)

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('el click en el backdrop llama a onClose una vez', () => {
      const onClose = vi.fn()
      render(<TwoItemSheet open onClose={onClose} />)

      const dialog = screen.getByRole('dialog')
      const backdrop = dialog.previousElementSibling as HTMLElement
      expect(backdrop).not.toBeNull()

      fireEvent.click(backdrop)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('el tap en el handle (44x3) llama a onClose una vez', () => {
      const onClose = vi.fn()
      render(<TwoItemSheet open onClose={onClose} />)

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('el click dentro del cuerpo del sheet NO llama a onClose', () => {
      const onClose = vi.fn()
      render(<TwoItemSheet open onClose={onClose} />)

      fireEvent.click(screen.getByText('Opciones'))
      fireEvent.click(screen.getByRole('button', { name: 'Uno' }))

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('trampa de foco', () => {
    it('mueve el foco a un elemento del sheet al abrirse', async () => {
      const user = userEvent.setup()
      render(<TwoItemHarness />)

      await user.click(screen.getByRole('button', { name: 'Abrir' }))

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveFocus()
    })

    // El handle ("Cerrar") es un <button> que aparece antes que el
    // contenido en el DOM, así que participa del ciclo del trap como su
    // primer nodo — si sólo el contenido formara el límite, un Tab que ya
    // dio la vuelta una vez lo dejaría inalcanzable por teclado el resto de
    // esa apertura (ver #78-adyacente, hallazgo de revisión).
    it('Tab desde el último foco enfocable vuelve al handle', async () => {
      const user = userEvent.setup()
      render(<TwoItemSheet open onClose={vi.fn()} />)

      const handle = screen.getByRole('button', { name: 'Cerrar' })
      const last = screen.getByRole('button', { name: 'Dos' })

      await user.click(last)
      expect(last).toHaveFocus()

      await user.tab()

      expect(handle).toHaveFocus()
    })

    it('Shift+Tab desde el handle va al último foco enfocable', async () => {
      const user = userEvent.setup()
      render(<TwoItemSheet open onClose={vi.fn()} />)

      const handle = screen.getByRole('button', { name: 'Cerrar' })
      const last = screen.getByRole('button', { name: 'Dos' })

      await user.click(handle)
      expect(handle).toHaveFocus()

      await user.tab({ shift: true })

      expect(last).toHaveFocus()
    })

    it('Tab justo al abrir (foco en el panel) va al handle, el primer foco enfocable', async () => {
      const user = userEvent.setup()
      render(<TwoItemHarness />)

      await user.click(screen.getByRole('button', { name: 'Abrir' }))
      expect(screen.getByRole('dialog')).toHaveFocus()

      const handle = screen.getByRole('button', { name: 'Cerrar' })
      await user.tab()

      expect(handle).toHaveFocus()
    })

    it('Shift+Tab justo al abrir (foco en el panel) va al último foco enfocable', async () => {
      const user = userEvent.setup()
      render(<TwoItemHarness />)

      await user.click(screen.getByRole('button', { name: 'Abrir' }))
      expect(screen.getByRole('dialog')).toHaveFocus()

      const last = screen.getByRole('button', { name: 'Dos' })
      await user.tab({ shift: true })

      expect(last).toHaveFocus()
    })

    it('el Tab natural entre el handle y el primer ítem del contenido no lo interrumpe el trap', async () => {
      const user = userEvent.setup()
      render(<TwoItemSheet open onClose={vi.fn()} />)

      const handle = screen.getByRole('button', { name: 'Cerrar' })
      const uno = screen.getByRole('button', { name: 'Uno' })

      await user.click(handle)
      await user.tab()
      expect(uno).toHaveFocus()

      await user.tab({ shift: true })
      expect(handle).toHaveFocus()
    })

    it('un sheet sin nada enfocable en el contenido igual permite llegar al handle con Tab', async () => {
      const user = userEvent.setup()
      render(<EmptySheet open onClose={vi.fn()} />)

      const dialog = screen.getByRole('dialog')
      const handle = screen.getByRole('button', { name: 'Cerrar' })
      expect(dialog).toHaveFocus()

      await user.tab()

      expect(handle).toHaveFocus()
    })

    it('un ítem enfocable único (el handle solo) cicla sobre sí mismo con Tab y Shift+Tab', async () => {
      const user = userEvent.setup()
      render(<EmptySheet open onClose={vi.fn()} />)

      const handle = screen.getByRole('button', { name: 'Cerrar' })

      await user.click(handle)
      await user.tab()
      expect(handle).toHaveFocus()

      await user.tab({ shift: true })
      expect(handle).toHaveFocus()
    })
  })

  describe('restauración de foco', () => {
    it('devuelve el foco al trigger original al cerrar', async () => {
      const user = userEvent.setup()
      render(<TwoItemHarness />)

      const trigger = screen.getByRole('button', { name: 'Abrir' })
      await user.click(trigger)
      expect(screen.getByRole('dialog')).toHaveFocus()

      await user.keyboard('{Escape}')

      expect(trigger).toHaveFocus()
    })

    it('no lanza ni intenta enfocar el trigger si éste se desmontó mientras el sheet estaba abierto', async () => {
      const user = userEvent.setup()
      render(<UnmountingTriggerHarness />)

      const trigger = screen.getByRole('button', { name: 'Abrir' })
      await user.click(trigger)

      // El spy se instala DESPUÉS de abrir: el propio userEvent.click ya
      // enfoca el trigger como parte de simular el click, y eso no debe
      // contarse como si el código de producción lo hubiera enfocado.
      const focusSpy = vi.spyOn(trigger, 'focus')
      await user.click(screen.getByRole('button', { name: 'Quitar trigger' }))
      expect(trigger).not.toBeInTheDocument()

      expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow()
      expect(focusSpy).not.toHaveBeenCalled()
    })
  })

  describe('accesibilidad general', () => {
    it('el bar decorativo del handle es aria-hidden', () => {
      render(<TwoItemSheet open onClose={vi.fn()} />)

      const handle = screen.getByRole('button', { name: 'Cerrar' })
      const bar = handle.querySelector('[aria-hidden="true"]')

      expect(bar).not.toBeNull()
    })

    it('todos los enlaces y botones tienen un nombre accesible no vacío', () => {
      const { container } = render(<TwoItemSheet open onClose={vi.fn()} />)

      const interactiveElements = container.querySelectorAll('a, button')
      expect(interactiveElements.length).toBeGreaterThan(0)

      for (const el of Array.from(interactiveElements)) {
        const ariaLabel = el.getAttribute('aria-label')
        const text = el.textContent?.trim()
        const accessibleName = ariaLabel || text || ''
        expect(accessibleName.length).toBeGreaterThan(0)
      }
    })

    it('no contiene ningún elemento con tabindex positivo (> 0)', () => {
      const { container } = render(<TwoItemSheet open onClose={vi.fn()} />)

      const elementsWithTabIndex = container.querySelectorAll('[tabindex]')
      for (const el of Array.from(elementsWithTabIndex)) {
        const val = parseInt(el.getAttribute('tabindex') || '0', 10)
        expect(val).toBeLessThanOrEqual(0)
      }
    })
  })
})
