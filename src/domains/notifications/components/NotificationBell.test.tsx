// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotificationBell } from './NotificationBell'

describe('NotificationBell', () => {
    it('links to the inbox with an accessible label and no badge when nothing is unread', () => {
        render(<NotificationBell unreadCount={0} />)

        const link = screen.getByRole('link', { name: 'Avisos' })
        expect(link).toHaveAttribute('href', '/notificaciones')
        expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument()
    })

    it('shows the unread count in the badge and in the accessible label', () => {
        render(<NotificationBell unreadCount={3} />)

        expect(screen.getByRole('link', { name: 'Avisos, 3 sin leer' })).toBeInTheDocument()
        expect(screen.getByTestId('notification-badge')).toHaveTextContent('3')
    })

    it('caps the badge at 9+', () => {
        render(<NotificationBell unreadCount={42} />)

        expect(screen.getByTestId('notification-badge')).toHaveTextContent('9+')
    })
})
