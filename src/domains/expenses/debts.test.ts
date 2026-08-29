import { describe, it, expect } from 'vitest'
import { computeDebts } from './debts'

describe('computeDebts', () => {
    it('[] sin gastos', () => {
        expect(computeDebts([])).toEqual([])
    })

    it('ignora gastos sin ningún tageado', () => {
        const result = computeDebts([{ user_id: 'u1', amount: 100, splits: [] }])
        expect(result).toEqual([])
    })

    it('divide en partes iguales entre quien pagó y un solo tageado', () => {
        const result = computeDebts([{ user_id: 'u1', amount: 100, splits: [{ user_id: 'u2' }] }])
        expect(result).toEqual([{ from_user_id: 'u2', to_user_id: 'u1', amount: 50 }])
    })

    it('divide entre quien pagó y varios tageados', () => {
        const result = computeDebts([
            { user_id: 'u1', amount: 90, splits: [{ user_id: 'u2' }, { user_id: 'u3' }] },
        ])
        // 90 / 3 participantes (u1 pagó + u2 + u3) = 30 cada uno
        expect(result).toEqual(
            expect.arrayContaining([
                { from_user_id: 'u2', to_user_id: 'u1', amount: 30 },
                { from_user_id: 'u3', to_user_id: 'u1', amount: 30 },
            ])
        )
        expect(result).toHaveLength(2)
    })

    it('acumula varios gastos del mismo par en vez de listarlos por separado', () => {
        const result = computeDebts([
            { user_id: 'u1', amount: 100, splits: [{ user_id: 'u2' }] },
            { user_id: 'u1', amount: 40, splits: [{ user_id: 'u2' }] },
        ])
        expect(result).toEqual([{ from_user_id: 'u2', to_user_id: 'u1', amount: 70 }])
    })

    it('no netea deudas cruzadas entre dos personas', () => {
        const result = computeDebts([
            { user_id: 'u1', amount: 100, splits: [{ user_id: 'u2' }] },
            { user_id: 'u2', amount: 100, splits: [{ user_id: 'u1' }] },
        ])
        expect(result).toEqual(
            expect.arrayContaining([
                { from_user_id: 'u2', to_user_id: 'u1', amount: 50 },
                { from_user_id: 'u1', to_user_id: 'u2', amount: 50 },
            ])
        )
        expect(result).toHaveLength(2)
    })

    it('redondea a centavos', () => {
        const result = computeDebts([{ user_id: 'u1', amount: 100, splits: [{ user_id: 'u2' }, { user_id: 'u3' }] }])
        // 100 / 3 = 33.333... -> 33.33
        expect(result.find((d) => d.from_user_id === 'u2')?.amount).toBe(33.33)
    })
})
