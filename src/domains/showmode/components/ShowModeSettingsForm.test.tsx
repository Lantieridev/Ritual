// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShowModeSettingsForm } from '@/src/domains/showmode/components/ShowModeSettingsForm'
import { DEFAULT_SHOW_MODE_PREFERENCES } from '@/src/domains/showmode/preferences'

function renderForm(
  overrides: Partial<React.ComponentProps<typeof ShowModeSettingsForm>> = {}
) {
  const savePreferences = vi.fn().mockResolvedValue({})
  const addTemplateItem = vi.fn().mockResolvedValue({ id: 't-9', label: 'Batería cargada' })
  const removeTemplateItem = vi.fn().mockResolvedValue({})
  const utils = render(
    <ShowModeSettingsForm
      initialPreferences={DEFAULT_SHOW_MODE_PREFERENCES}
      initialTemplateItems={[{ id: 't-1', label: 'Entrada en el celular', position: 0 }]}
      savePreferences={savePreferences}
      addTemplateItem={addTemplateItem}
      removeTemplateItem={removeTemplateItem}
      {...overrides}
    />
  )
  return { ...utils, savePreferences, addTemplateItem, removeTemplateItem }
}

describe('ShowModeSettingsForm — la ventana', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('precarga la ventana configurada', () => {
    renderForm()
    expect(screen.getByLabelText('Días antes')).toHaveValue(7)
    expect(screen.getByLabelText('Días después')).toHaveValue(2)
  })

  it('guarda la ventana nueva', async () => {
    const user = userEvent.setup()
    const { savePreferences } = renderForm()

    const before = screen.getByLabelText('Días antes')
    await user.clear(before)
    await user.type(before, '14')
    await user.click(screen.getByRole('button', { name: /Guardar ventana/ }))

    await waitFor(() =>
      expect(savePreferences).toHaveBeenCalledWith({ daysBefore: 14, daysAfter: 2 })
    )
    expect(await screen.findByRole('status')).toHaveTextContent('Guardado')
  })

  it('muestra el error de la action sin decir que guardó', async () => {
    const user = userEvent.setup()
    const savePreferences = vi.fn().mockResolvedValue({ error: 'Usuario no autenticado' })
    renderForm({ savePreferences })

    await user.click(screen.getByRole('button', { name: /Guardar ventana/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario no autenticado')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('expone los límites en los propios inputs', () => {
    renderForm()
    expect(screen.getByLabelText('Días antes')).toHaveAttribute('max', '60')
    expect(screen.getByLabelText('Días después')).toHaveAttribute('max', '14')
  })
})

describe('ShowModeSettingsForm — la plantilla base', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista los ítems ya configurados', () => {
    renderForm()
    expect(screen.getByText('Entrada en el celular')).toBeInTheDocument()
  })

  it('agrega un ítem a la plantilla y lo muestra sin recargar', async () => {
    const user = userEvent.setup()
    const { addTemplateItem } = renderForm()

    await user.type(screen.getByLabelText('Nuevo ítem de la plantilla'), 'Batería cargada')
    await user.click(screen.getByRole('button', { name: 'Agregar' }))

    await waitFor(() => expect(addTemplateItem).toHaveBeenCalledWith('Batería cargada'))
    expect(await screen.findByText('Batería cargada')).toBeInTheDocument()
  })

  it('no manda una action por un ítem vacío', async () => {
    const user = userEvent.setup()
    const { addTemplateItem } = renderForm()

    await user.click(screen.getByRole('button', { name: 'Agregar' }))

    expect(addTemplateItem).not.toHaveBeenCalled()
  })

  it('borra un ítem de la plantilla', async () => {
    const user = userEvent.setup()
    const { removeTemplateItem } = renderForm()

    await user.click(screen.getByRole('button', { name: 'Borrar' }))

    await waitFor(() => expect(removeTemplateItem).toHaveBeenCalledWith('t-1'))
    await waitFor(() =>
      expect(screen.queryByText('Entrada en el celular')).not.toBeInTheDocument()
    )
  })

  it('mantiene el ítem en la lista si el borrado falla', async () => {
    const user = userEvent.setup()
    const removeTemplateItem = vi.fn().mockResolvedValue({ error: 'No tenés permiso.' })
    renderForm({ removeTemplateItem })

    await user.click(screen.getByRole('button', { name: 'Borrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No tenés permiso.')
    expect(screen.getByText('Entrada en el celular')).toBeInTheDocument()
  })

  it('explica que la plantilla se configura una vez y sirve para todos los shows', () => {
    renderForm()
    expect(screen.getByText(/aparece en el checklist de todos tus shows/)).toBeInTheDocument()
  })

  it('muestra un estado vacío útil cuando la plantilla no tiene nada', () => {
    renderForm({ initialTemplateItems: [] })
    expect(screen.getByText(/La plantilla está vacía/)).toBeInTheDocument()
  })
})
