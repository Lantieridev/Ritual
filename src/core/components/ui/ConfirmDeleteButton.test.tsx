// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDeleteButton } from './ConfirmDeleteButton'

describe('ConfirmDeleteButton', () => {
  it('shows only the trigger before confirming', () => {
    render(<ConfirmDeleteButton label="Eliminar" confirmMessage="¿Seguro?" onConfirm={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
    expect(screen.queryByText('¿Seguro?')).not.toBeInTheDocument()
  })

  it('shows the confirm message after the first click', async () => {
    render(<ConfirmDeleteButton label="Eliminar" confirmMessage="¿Seguro?" onConfirm={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(screen.getByText('¿Seguro?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sí, eliminar/ })).toBeInTheDocument()
  })

  it('cancels back to the initial state without calling onConfirm', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmDeleteButton label="Eliminar" confirmMessage="¿Seguro?" onConfirm={onConfirm} />)

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onConfirm when confirmed', async () => {
    const onConfirm = vi.fn().mockResolvedValue({})
    render(<ConfirmDeleteButton label="Eliminar" confirmMessage="¿Seguro?" onConfirm={onConfirm} />)

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    await userEvent.click(screen.getByRole('button', { name: /Sí, eliminar/ }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('shows the error and stays in confirming state when onConfirm fails', async () => {
    const onConfirm = vi.fn().mockResolvedValue({ error: 'No se pudo eliminar' })
    render(<ConfirmDeleteButton label="Eliminar" confirmMessage="¿Seguro?" onConfirm={onConfirm} />)

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    await userEvent.click(screen.getByRole('button', { name: /Sí, eliminar/ }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo eliminar')
    })
    expect(screen.getByRole('button', { name: /Sí, eliminar/ })).toBeInTheDocument()
  })
})
