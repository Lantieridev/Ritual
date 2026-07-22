// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Combobox, type ComboboxOption } from './Combobox'

const options: ComboboxOption[] = [
  { id: '1', label: 'Niceto', sublabel: 'CABA' },
  { id: '2', label: 'Luna Park', sublabel: 'CABA' },
]

describe('Combobox', () => {
  it('filters options as the user types', async () => {
    render(<Combobox options={options} onSelect={vi.fn()} />)

    await userEvent.type(screen.getByRole('combobox'), 'Luna')

    expect(screen.getByRole('option', { name: /Luna Park/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Niceto/ })).not.toBeInTheDocument()
  })

  it('calls onSelect and clears the query when an option is clicked', async () => {
    const onSelect = vi.fn()
    render(<Combobox options={options} onSelect={onSelect} />)

    await userEvent.type(screen.getByRole('combobox'), 'Niceto')
    await userEvent.click(screen.getByRole('option', { name: /Niceto/ }))

    expect(onSelect).toHaveBeenCalledWith(options[0])
    expect(screen.getByRole('combobox')).toHaveValue('')
  })

  it('excludes ids already selected elsewhere', async () => {
    render(<Combobox options={options} excludeIds={new Set(['1'])} onSelect={vi.fn()} />)

    await userEvent.type(screen.getByRole('combobox'), 'N')

    expect(screen.queryByRole('option', { name: /Niceto/ })).not.toBeInTheDocument()
  })

  it('does not offer "create" when there is no onCreate handler', async () => {
    render(<Combobox options={options} onSelect={vi.fn()} />)

    await userEvent.type(screen.getByRole('combobox'), 'Un lugar nuevo')

    expect(screen.queryByText(/Crear/)).not.toBeInTheDocument()
  })

  it('offers "create" for a query with no exact match, and calls onCreate', async () => {
    const onSelect = vi.fn()
    const onCreate = vi.fn().mockResolvedValue({ id: 'new-1', label: 'Un lugar nuevo' })
    render(<Combobox options={options} onSelect={onSelect} onCreate={onCreate} />)

    await userEvent.type(screen.getByRole('combobox'), 'Un lugar nuevo')
    await userEvent.click(screen.getByRole('option', { name: /Crear "Un lugar nuevo"/ }))

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith('Un lugar nuevo')
      expect(onSelect).toHaveBeenCalledWith({ id: 'new-1', label: 'Un lugar nuevo' })
    })
  })

  it('does not offer "create" when the query exactly matches an existing option', async () => {
    render(<Combobox options={options} onSelect={vi.fn()} onCreate={vi.fn()} />)

    await userEvent.type(screen.getByRole('combobox'), 'Niceto')

    expect(screen.queryByText(/Crear/)).not.toBeInTheDocument()
  })

  it('shows the error from onCreate without selecting anything', async () => {
    const onSelect = vi.fn()
    const onCreate = vi.fn().mockResolvedValue({ error: 'Ya existe una sede con ese nombre.' })
    render(<Combobox options={options} onSelect={onSelect} onCreate={onCreate} />)

    await userEvent.type(screen.getByRole('combobox'), 'Niceto Duplicado')
    await userEvent.click(screen.getByRole('option', { name: /Crear/ }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ya existe una sede con ese nombre.')
    })
    expect(onSelect).not.toHaveBeenCalled()
  })
})
