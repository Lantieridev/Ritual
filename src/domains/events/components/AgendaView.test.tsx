// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgendaView } from '@/src/domains/events/components/AgendaView'
import type { EventWithAttendance } from '@/src/domains/events/service'

// Relativas a "ahora" a propósito: una fecha futura hardcodeada (2027, etc.)
// deja de serlo con el tiempo y el test empieza a fallar en silencio meses
// después, sin que nadie tocara este archivo.
const inNextYear = (monthsFromNow: number) => {
    const d = new Date()
    d.setMonth(d.getMonth() + monthsFromNow)
    return d.toISOString()
}
const pastYear = new Date().getFullYear() - 2

const mockEvents: EventWithAttendance[] = [
    {
        id: 'e1',
        name: 'Show Pasado',
        date: `${pastYear}-03-10T20:00:00Z`,
        venue_id: 'v1',
        venues: { name: 'Luna Park', city: 'CABA', country: 'AR' },
        lineups: [{ artists: { id: 'a1', name: 'Artista 1', genre: 'Rock' } }],
        attendance: [
            { id: 'att1', user_id: 'u1', status: 'went', rating: 5, review: 'Una masa' },
        ],
    },
    {
        id: 'e2',
        name: 'Show Futuro Going',
        date: inNextYear(6),
        venue_id: 'v2',
        venues: { name: 'Niceto Club', city: 'CABA', country: 'AR' },
        lineups: [{ artists: { id: 'a2', name: 'Artista 2', genre: 'Indie' } }],
        attendance: [
            { id: 'att2', user_id: 'u1', status: 'going', rating: null, review: null },
        ],
    },
    {
        id: 'e3',
        name: 'Show Futuro Interested',
        date: inNextYear(10),
        venue_id: 'v3',
        venues: { name: 'Movistar Arena', city: 'CABA', country: 'AR' },
        lineups: [{ artists: { id: 'a3', name: 'Artista 3', genre: 'Pop' } }],
        attendance: [
            { id: 'att3', user_id: 'u1', status: 'interested', rating: null, review: null },
        ],
    },
]

describe('AgendaView', () => {
    it('filtra por tab: "Todos" muestra los 3, "Próximos" sólo futuros, "Vividos" sólo went', () => {
        render(<AgendaView events={mockEvents} />)

        // Tab "Todos" por defecto
        expect(screen.getByText('Show Pasado')).toBeInTheDocument()
        expect(screen.getByText('Show Futuro Going')).toBeInTheDocument()
        expect(screen.getByText('Show Futuro Interested')).toBeInTheDocument()

        // Cambiar a "Próximos"
        fireEvent.click(screen.getByRole('button', { name: 'Próximos' }))
        expect(screen.queryByText('Show Pasado')).not.toBeInTheDocument()
        expect(screen.getByText('Show Futuro Going')).toBeInTheDocument()
        expect(screen.getByText('Show Futuro Interested')).toBeInTheDocument()

        // Cambiar a "Vividos"
        fireEvent.click(screen.getByRole('button', { name: 'Vividos' }))
        expect(screen.getByText('Show Pasado')).toBeInTheDocument()
        expect(screen.queryByText('Show Futuro Going')).not.toBeInTheDocument()
        expect(screen.queryByText('Show Futuro Interested')).not.toBeInTheDocument()
    })

    it('muestra rating y reseña en "went" y badges en "going" / "interested"', () => {
        render(<AgendaView events={mockEvents} />)

        // Fila "went"
        expect(screen.getByLabelText('5 de 5 estrellas')).toBeInTheDocument()
        expect(screen.getByText('“Una masa”')).toBeInTheDocument()

        // Filas "going" e "interested" muestran badges
        expect(screen.getByText('Voy a ir')).toBeInTheDocument()
        expect(screen.getByText('Me interesa')).toBeInTheDocument()
    })

    it('cambia de tab de manera sincrónica sin requerir async/fetch', () => {
        render(<AgendaView events={mockEvents} />)

        const vividosBtn = screen.getByRole('button', { name: 'Vividos' })
        fireEvent.click(vividosBtn)

        // Verificación sincrónica inmediata
        expect(screen.getByText('Show Pasado')).toBeInTheDocument()
        expect(screen.queryByText('Show Futuro Going')).not.toBeInTheDocument()
    })

    it('muestra estados vacíos específicos por tab', () => {
        render(<AgendaView events={[]} />)

        // Tab "Todos" vacía por defecto
        expect(screen.getByText('Todavía no cargaste nada')).toBeInTheDocument()

        // Tab "Próximos" vacía
        fireEvent.click(screen.getByRole('button', { name: 'Próximos' }))
        expect(screen.getByText('Nada agendado')).toBeInTheDocument()

        // Tab "Vividos" vacía
        fireEvent.click(screen.getByRole('button', { name: 'Vividos' }))
        expect(screen.getByText('Todavía no hay ningún talón')).toBeInTheDocument()
    })

    it('agrupa eventos por año mostrando los encabezados correspondientes', () => {
        render(<AgendaView events={mockEvents} />)

        expect(screen.getByText(String(pastYear))).toBeInTheDocument()
        // "Próximos" y "Vividos" pueden coincidir en el mismo año calendario
        // según cuándo corra el test — sólo importa que el pasado aparezca
        // separado de al menos un año futuro real.
        const futureYear = new Date(inNextYear(6)).getFullYear()
        expect(screen.getByText(String(futureYear))).toBeInTheDocument()
    })
})
