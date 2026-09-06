// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MorningAfterScore } from '@/src/domains/events/components/MorningAfterScore'

const { refresh, saveMemory } = vi.hoisted(() => ({ refresh: vi.fn(), saveMemory: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/src/domains/events/attendance-actions', () => ({ saveMemory }))

beforeEach(() => {
  refresh.mockReset()
  saveMemory.mockReset()
})

describe('MorningAfterScore', () => {
  it('ofrece la escala real de Ritual: cinco botones, del 1 al 5', () => {
    render(<MorningAfterScore eventId="e1" />)

    const labels = screen.getAllByRole('button').map((b) => b.textContent)
    expect(labels).toEqual(['1', '2', '3', '4', '5'])
  })

  it('guarda el puntaje elegido y refresca Home para salir del estado', async () => {
    saveMemory.mockResolvedValue({})
    render(<MorningAfterScore eventId="e1" />)

    fireEvent.click(screen.getByRole('button', { name: '4' }))

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(saveMemory).toHaveBeenCalledWith('e1', { rating: 4 })
  })

  it('ilumina en rojo hasta el puntaje elegido', () => {
    saveMemory.mockReturnValue(new Promise(() => {}))
    render(<MorningAfterScore eventId="e1" />)

    fireEvent.click(screen.getByRole('button', { name: '3' }))

    expect(screen.getByRole('button', { name: '3' }).className).toContain('bg-ritual-red')
    expect(screen.getByRole('button', { name: '1' }).className).toContain('bg-ritual-red')
    expect(screen.getByRole('button', { name: '4' }).className).not.toContain('bg-ritual-red')
  })

  it('si no se pudo guardar, lo dice y no deja nada marcado', async () => {
    saveMemory.mockResolvedValue({ error: 'No se pudo guardar el puntaje.' })
    render(<MorningAfterScore eventId="e1" />)

    fireEvent.click(screen.getByRole('button', { name: '2' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el puntaje.')
    expect(screen.getByRole('button', { name: '1' }).className).not.toContain('bg-ritual-red')
    expect(refresh).not.toHaveBeenCalled()
  })
})
