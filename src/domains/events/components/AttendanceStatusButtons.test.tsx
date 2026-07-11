// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockSetAttendanceStatus = vi.fn()

vi.mock('@/src/domains/events/attendance-actions', () => ({
  setAttendanceStatus: (...args: unknown[]) => mockSetAttendanceStatus(...args),
}))

import { AttendanceStatusButtons } from '@/src/domains/events/components/AttendanceStatusButtons'

describe('AttendanceStatusButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows only "Fui" for past events', () => {
    render(<AttendanceStatusButtons eventId="e1" currentStatus={null} isPast={true} />)

    expect(screen.getByRole('button', { name: /Fui/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Me interesa/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Voy a ir/ })).not.toBeInTheDocument()
  })

  it('shows "Me interesa" and "Voy a ir" for future events, not "Fui"', () => {
    render(<AttendanceStatusButtons eventId="e1" currentStatus={null} isPast={false} />)

    expect(screen.getByRole('button', { name: /Me interesa/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Voy a ir/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^✅ Fui/ })).not.toBeInTheDocument()
  })

  it('warns when the saved status does not match the options available for this event\'s timing', () => {
    render(<AttendanceStatusButtons eventId="e1" currentStatus="going" isPast={true} />)

    expect(screen.getByText(/Tenías marcado "quiero ir"/)).toBeInTheDocument()
  })

  it('calls setAttendanceStatus and marks the option active on success', async () => {
    mockSetAttendanceStatus.mockResolvedValue({})
    render(<AttendanceStatusButtons eventId="e1" currentStatus={null} isPast={false} />)

    await userEvent.click(screen.getByRole('button', { name: /Voy a ir/ }))

    expect(mockSetAttendanceStatus).toHaveBeenCalledWith('e1', 'going')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Voy a ir/ })).toHaveClass('bg-white')
    })
  })

  it('does not mark the option active when the action returns an error', async () => {
    mockSetAttendanceStatus.mockResolvedValue({ error: 'boom' })
    render(<AttendanceStatusButtons eventId="e1" currentStatus={null} isPast={false} />)

    await userEvent.click(screen.getByRole('button', { name: /Voy a ir/ }))

    await waitFor(() => {
      expect(mockSetAttendanceStatus).toHaveBeenCalled()
    })
    expect(screen.getByRole('button', { name: /Voy a ir/ })).not.toHaveClass('bg-white')
  })
})
