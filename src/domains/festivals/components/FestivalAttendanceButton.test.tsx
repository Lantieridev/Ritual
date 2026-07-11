// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockSaveFestivalAttendance = vi.fn()

vi.mock('@/src/domains/festivals/actions', () => ({
  saveFestivalAttendance: (...args: unknown[]) => mockSaveFestivalAttendance(...args),
}))

import { FestivalAttendanceButton } from '@/src/domains/festivals/components/FestivalAttendanceButton'

describe('FestivalAttendanceButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveFestivalAttendance.mockResolvedValue({})
  })

  it('shows a generic prompt when there is no saved status', () => {
    render(<FestivalAttendanceButton festivalId="f1" />)
    expect(screen.getByRole('button', { name: /Marcar asistencia/ })).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows the current status label when one is set', () => {
    render(<FestivalAttendanceButton festivalId="f1" initialStatus="going" />)
    expect(screen.getByRole('button', { name: /Voy/ })).toBeInTheDocument()
  })

  it('opens the option menu on click', async () => {
    render(<FestivalAttendanceButton festivalId="f1" />)

    await userEvent.click(screen.getByRole('button'))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: /Me interesa/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: /Fui/ })).toBeInTheDocument()
  })

  it('calls saveFestivalAttendance with the selected status and closes the menu', async () => {
    render(<FestivalAttendanceButton festivalId="f1" />)

    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByRole('menuitemradio', { name: /Voy/ }))

    expect(mockSaveFestivalAttendance).toHaveBeenCalledWith('f1', 'going')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes the menu when Escape is pressed', async () => {
    render(<FestivalAttendanceButton festivalId="f1" />)

    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
