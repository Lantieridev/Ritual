// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockSaveFestivalAttendance = vi.fn()

vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return { ...actual, useMutation: () => [{ fetching: false }, mockSaveFestivalAttendance] }
})

import { FestivalAttendanceButton } from '@/src/domains/festivals/components/FestivalAttendanceButton'
import { TRANSPORT_ERROR_MESSAGE } from '@/src/graphql/mutation-result'
import { transportError } from '@/src/graphql/transport-failure.testing'

describe('FestivalAttendanceButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveFestivalAttendance.mockResolvedValue({
      data: { saveFestivalAttendance: { success: true } },
    })
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

    expect(mockSaveFestivalAttendance).toHaveBeenCalledWith({ festivalId: 'f1', status: 'going' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes the menu when Escape is pressed', async () => {
    render(<FestivalAttendanceButton festivalId="f1" />)

    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('rolls back the optimistic status and shows an error when the request never reaches the resolver', async () => {
    mockSaveFestivalAttendance.mockResolvedValue({ data: undefined, error: transportError() })
    render(<FestivalAttendanceButton festivalId="f1" initialStatus="interested" />)

    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByRole('menuitemradio', { name: /Voy/ }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(TRANSPORT_ERROR_MESSAGE)
    })
    expect(screen.getByRole('button', { name: /Me interesa/ })).toBeInTheDocument()
  })
})
