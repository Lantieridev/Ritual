// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PreShowChecklist } from '@/src/domains/showmode/components/PreShowChecklist'
import type { ResolvedChecklistItem } from '@/src/domains/showmode/checklist'

const items: ResolvedChecklistItem[] = [
  { id: 't-1', label: 'Entrada en el celular', checked: false, source: 'template' },
  { id: 't-2', label: 'Efectivo', checked: true, source: 'template' },
  { id: 'a-1', label: 'Cargar la SUBE', checked: false, source: 'adhoc' },
]

function renderChecklist(
  overrides: Partial<React.ComponentProps<typeof PreShowChecklist>> = {}
) {
  const setChecked = vi.fn().mockResolvedValue({})
  const addItem = vi.fn().mockResolvedValue({ id: 'a-2', label: 'Campera' })
  const removeItem = vi.fn().mockResolvedValue({})
  const utils = render(
    <PreShowChecklist
      eventId="ev-1"
      initialItems={items}
      setChecked={setChecked}
      addItem={addItem}
      removeItem={removeItem}
      {...overrides}
    />
  )
  return { ...utils, setChecked, addItem, removeItem }
}

describe('PreShowChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra la plantilla y los ítems del show en una sola lista', () => {
    renderChecklist()
    expect(screen.getByText('Entrada en el celular')).toBeInTheDocument()
    expect(screen.getByText('Efectivo')).toBeInTheDocument()
    expect(screen.getByText('Cargar la SUBE')).toBeInTheDocument()
  })

  it('cuenta cuántos ítems están listos', () => {
    renderChecklist()
    expect(screen.getByText('1 de 3 listo')).toBeInTheDocument()
  })

  it('marca de dónde viene cada ítem para que se entienda cuál se edita en los ajustes', () => {
    renderChecklist()
    expect(screen.getAllByText('Plantilla')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Quitar' })).toHaveLength(1)
  })

  it('tilda un ítem de plantilla pasando su origen, para que el estado vaya a la tabla correcta', async () => {
    const user = userEvent.setup()
    const { setChecked } = renderChecklist()

    await user.click(screen.getByRole('checkbox', { name: /Entrada en el celular/ }))

    await waitFor(() => {
      expect(setChecked).toHaveBeenCalledWith('ev-1', 't-1', 'template', true)
    })
  })

  it('tilda un ítem ad-hoc marcándolo como tal', async () => {
    const user = userEvent.setup()
    const { setChecked } = renderChecklist()

    await user.click(screen.getByRole('checkbox', { name: /Cargar la SUBE/ }))

    await waitFor(() => {
      expect(setChecked).toHaveBeenCalledWith('ev-1', 'a-1', 'adhoc', true)
    })
  })

  it('destilda un ítem que ya estaba tildado', async () => {
    const user = userEvent.setup()
    const { setChecked } = renderChecklist()

    await user.click(screen.getByRole('checkbox', { name: /Efectivo/ }))

    await waitFor(() => {
      expect(setChecked).toHaveBeenCalledWith('ev-1', 't-2', 'template', false)
    })
  })

  it('actualiza el progreso apenas se tilda, sin esperar el round-trip', async () => {
    const user = userEvent.setup()
    renderChecklist()

    await user.click(screen.getByRole('checkbox', { name: /Entrada en el celular/ }))

    expect(await screen.findByText('2 de 3 listos')).toBeInTheDocument()
  })

  it('revierte el tilde y muestra el error si la action falla', async () => {
    const user = userEvent.setup()
    const setChecked = vi.fn().mockResolvedValue({ error: 'No tenés permiso.' })
    renderChecklist({ setChecked })

    const checkbox = screen.getByRole('checkbox', { name: /Entrada en el celular/ })
    await user.click(checkbox)

    expect(await screen.findByRole('alert')).toHaveTextContent('No tenés permiso.')
    await waitFor(() => expect(checkbox).not.toBeChecked())
  })

  it('agrega un ítem puntual del show sin tocar la plantilla', async () => {
    const user = userEvent.setup()
    const { addItem } = renderChecklist()

    await user.click(screen.getByRole('button', { name: /Ítem para este show/ }))
    await user.type(screen.getByLabelText('Ítem para este show'), 'Campera')
    await user.click(screen.getByRole('button', { name: 'Agregar' }))

    await waitFor(() => expect(addItem).toHaveBeenCalledWith('ev-1', 'Campera'))
    expect(await screen.findByText('Campera')).toBeInTheDocument()
  })

  it('no manda una action por un ítem vacío', async () => {
    const user = userEvent.setup()
    const { addItem } = renderChecklist()

    await user.click(screen.getByRole('button', { name: /Ítem para este show/ }))
    await user.click(screen.getByRole('button', { name: 'Agregar' }))

    expect(addItem).not.toHaveBeenCalled()
  })

  it('quita un ítem del show de la lista', async () => {
    const user = userEvent.setup()
    const { removeItem } = renderChecklist()

    await user.click(screen.getByRole('button', { name: 'Quitar' }))

    await waitFor(() => expect(removeItem).toHaveBeenCalledWith('ev-1', 'a-1'))
    await waitFor(() => expect(screen.queryByText('Cargar la SUBE')).not.toBeInTheDocument())
  })

  it('invita a armar la plantilla base cuando no hay ningún ítem todavía', () => {
    renderChecklist({ initialItems: [] })
    expect(screen.getByText(/Todavía no armaste tu plantilla base/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Configurala una vez/ })).toHaveAttribute(
      'href',
      '/modo-recital'
    )
  })

  it('expone el progreso de forma accesible', () => {
    renderChecklist()
    const bar = screen.getByRole('progressbar', { name: 'Progreso del checklist' })
    expect(bar).toHaveAttribute('aria-valuenow', '1')
    expect(bar).toHaveAttribute('aria-valuemax', '3')
  })
})
