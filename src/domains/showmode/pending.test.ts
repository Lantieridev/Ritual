import { describe, it, expect } from 'vitest'
import { computePendingForShow, isMemoryCardReady } from '@/src/domains/showmode/pending'
import type { ShowCompletionInput } from '@/src/domains/showmode/pending'

const complete: ShowCompletionInput = {
    attendanceStatus: 'went',
    expenseCount: 3,
    rating: 5,
    review: 'Una locura.',
}

describe('computePendingForShow', () => {
    it('no devuelve nada pendiente cuando el show está completo', () => {
        expect(computePendingForShow(complete)).toEqual([])
    })

    it(
        'cuando el usuario no confirmó que fue, ese es el único pendiente — todo lo demás ' +
            'cuelga de esa respuesta y listarlo junto convierte el aviso en ruido',
        () => {
            const pending = computePendingForShow({
                attendanceStatus: null,
                expenseCount: 0,
                rating: null,
                review: null,
            })
            expect(pending).toEqual([{ kind: 'attendance', label: 'Confirmar si fuiste' }])
        }
    )

    it('trata "going" igual que sin confirmar: el show todavía no está marcado como ido', () => {
        const pending = computePendingForShow({ ...complete, attendanceStatus: 'going' })
        expect(pending.map((p) => p.kind)).toEqual(['attendance'])
    })

    it('trata "interested" igual que sin confirmar', () => {
        const pending = computePendingForShow({ ...complete, attendanceStatus: 'interested' })
        expect(pending.map((p) => p.kind)).toEqual(['attendance'])
    })

    it('marca los gastos como pendientes cuando no se cargó ninguno', () => {
        const pending = computePendingForShow({ ...complete, expenseCount: 0 })
        expect(pending.map((p) => p.kind)).toEqual(['expenses'])
    })

    it('marca el rating como pendiente cuando no hay puntaje', () => {
        const pending = computePendingForShow({ ...complete, rating: null })
        expect(pending.map((p) => p.kind)).toEqual(['rating'])
    })

    it('marca la reseña como pendiente cuando está vacía', () => {
        const pending = computePendingForShow({ ...complete, review: null })
        expect(pending.map((p) => p.kind)).toEqual(['review'])
    })

    it('trata una reseña de puros espacios como no escrita', () => {
        const pending = computePendingForShow({ ...complete, review: '   \n  ' })
        expect(pending.map((p) => p.kind)).toEqual(['review'])
    })

    it('acepta un rating de 0 como cargado (no confunde 0 con "sin puntaje")', () => {
        const pending = computePendingForShow({ ...complete, rating: 0 })
        expect(pending).toEqual([])
    })

    it('junta todos los pendientes en un solo aviso, en el orden en que conviene resolverlos', () => {
        const pending = computePendingForShow({
            attendanceStatus: 'went',
            expenseCount: 0,
            rating: null,
            review: '',
        })
        expect(pending.map((p) => p.kind)).toEqual(['expenses', 'rating', 'review'])
    })
})

describe('isMemoryCardReady', () => {
    it('la tarjeta está lista cuando no queda nada pendiente', () => {
        expect(isMemoryCardReady(computePendingForShow(complete))).toBe(true)
    })

    it('no está lista mientras falte algo por cargar', () => {
        expect(isMemoryCardReady(computePendingForShow({ ...complete, rating: null }))).toBe(false)
    })

    it(
        'el clima no entra en la condición: no lo carga el usuario, así que su ausencia ' +
            'nunca puede bloquear el recuerdo',
        () => {
            // `complete` no menciona clima en ningún lado y aun así da lista.
            expect(isMemoryCardReady(computePendingForShow(complete))).toBe(true)
        }
    )
})
