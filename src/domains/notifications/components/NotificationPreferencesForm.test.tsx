// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const executeMutation = vi.fn()
vi.mock('urql', () => ({
    gql: (s: TemplateStringsArray) => s.join(''),
    useMutation: () => [{}, executeMutation],
}))

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { NotificationPreferencesForm } from './NotificationPreferencesForm'

const preferences = [
    { type: 'post_show_reminder' as const, label: 'Recordatorio post-show', description: 'Un solo aviso.', inApp: true, email: true },
    { type: 'admin_message' as const, label: 'Mensajes del equipo', description: 'Avisos del equipo.', inApp: true, email: false },
]

describe('NotificationPreferencesForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        executeMutation.mockResolvedValue({ data: { updateNotificationPreference: { success: true, error: null } } })
    })

    it('renders one switch per type and channel with the stored state', () => {
        render(<NotificationPreferencesForm preferences={preferences} />)

        expect(screen.getByRole('checkbox', { name: 'Recordatorio post-show — en la app' })).toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'Mensajes del equipo — email' })).not.toBeChecked()
    })

    it('saves the changed channel keeping the other one', async () => {
        render(<NotificationPreferencesForm preferences={preferences} />)

        await userEvent.click(screen.getByRole('checkbox', { name: 'Recordatorio post-show — email' }))

        await waitFor(() =>
            expect(executeMutation).toHaveBeenCalledWith({ type: 'post_show_reminder', inApp: true, email: false })
        )
        expect(refresh).toHaveBeenCalled()
    })

    it('reverts the switch and shows the error when saving fails', async () => {
        executeMutation.mockResolvedValue({ data: { updateNotificationPreference: { success: false, error: 'No pudimos guardar tus preferencias.' } } })
        render(<NotificationPreferencesForm preferences={preferences} />)

        await userEvent.click(screen.getByRole('checkbox', { name: 'Recordatorio post-show — email' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos guardar tus preferencias.')
        expect(screen.getByRole('checkbox', { name: 'Recordatorio post-show — email' })).toBeChecked()
    })
})
