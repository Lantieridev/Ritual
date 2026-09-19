// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotificationList } from './NotificationList'

const items = [
    { id: 'n1', type: 'post_show_reminder' as const, title: 'Te faltan datos', body: 'Puntuar el show\nEscribir la reseña', readAt: null, createdAt: '2026-09-19T10:00:00Z' },
    { id: 'n2', type: 'admin_message' as const, title: 'Hola', body: 'Texto', readAt: '2026-09-19T11:00:00Z', createdAt: '2026-09-18T10:00:00Z' },
]

describe('NotificationList', () => {
    it('shows an empty state', () => {
        render(<NotificationList items={[]} />)

        expect(screen.getByText('No tenés avisos todavía.')).toBeInTheDocument()
    })

    it('renders title and body of each notification', () => {
        render(<NotificationList items={items} />)

        expect(screen.getByText('Te faltan datos')).toBeInTheDocument()
        expect(screen.getByText(/Puntuar el show/)).toBeInTheDocument()
        expect(screen.getByText('Hola')).toBeInTheDocument()
    })

    it('marks unread items so they can be told apart from read ones', () => {
        render(<NotificationList items={items} />)

        expect(screen.getByText('Te faltan datos').closest('li')).toHaveAttribute('data-unread', 'true')
        expect(screen.getByText('Hola').closest('li')).toHaveAttribute('data-unread', 'false')
    })
})
