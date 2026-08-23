import { describe, it, expect } from 'vitest'
import { resolveShowModeWindow, describeShowModePhase } from '@/src/domains/showmode/window'
import { DEFAULT_SHOW_MODE_PREFERENCES } from '@/src/domains/showmode/preferences'

// Mediodía ART para que la referencia no quede pegada al borde del día en UTC.
const NOW = new Date('2026-05-10T15:00:00Z')
const prefs = DEFAULT_SHOW_MODE_PREFERENCES // 7 antes / 2 después

function phaseOf(startDate: string, endDate?: string | null) {
    return resolveShowModeWindow({ startDate, endDate }, prefs, NOW).phase
}

describe('resolveShowModeWindow — show de un día', () => {
    it('no activa el modo para un show más lejano que la ventana configurada', () => {
        expect(phaseOf('2026-05-30')).toBe('upcoming')
    })

    it('activa el modo justo en el borde de la ventana previa (7 días antes)', () => {
        expect(phaseOf('2026-05-17')).toBe('before')
    })

    it('deja fuera el día inmediatamente anterior al borde de la ventana', () => {
        expect(phaseOf('2026-05-18')).toBe('upcoming')
    })

    it('marca "during" el día del show', () => {
        expect(phaseOf('2026-05-10')).toBe('during')
    })

    it('no corta en seco: sigue activo el día después del show', () => {
        expect(phaseOf('2026-05-09')).toBe('after')
    })

    it('sigue activo en el último día de la ventana posterior', () => {
        expect(phaseOf('2026-05-08')).toBe('after')
    })

    it('cierra la ventana pasados los días configurados', () => {
        expect(phaseOf('2026-05-07')).toBe('closed')
    })

    it(
        'compara por día calendario en la timezone de la app, no por instante: un show de las ' +
            '21hs ART guardado como 00:00Z del día siguiente sigue siendo "during" hoy',
        () => {
            // 2026-05-11T00:00Z es 2026-05-10 21:00 en Argentina — el show de hoy.
            expect(phaseOf('2026-05-11T00:00:00Z')).toBe('during')
        }
    )

    it('resuelve un timestamp con offset explícito al día que corresponde en Argentina', () => {
        expect(phaseOf('2026-05-10T21:00:00-03:00')).toBe('during')
    })
})

describe('resolveShowModeWindow — festivales multi-día', () => {
    const festival = { startDate: '2026-05-08', endDate: '2026-05-12' }

    it('está "during" en un día intermedio del festival, no "after" por haber pasado el primer día', () => {
        const window = resolveShowModeWindow(festival, prefs, NOW)
        expect(window.phase).toBe('during')
        expect(window.isMultiDay).toBe(true)
    })

    it('se activa desde el primer día: la ventana previa se cuenta contra el comienzo', () => {
        // Comienza en 6 días (dentro de los 7), termina en 10.
        expect(phaseOf('2026-05-16', '2026-05-20')).toBe('before')
    })

    it('cuenta la ventana posterior desde el último día, no desde el primero', () => {
        // Terminó ayer aunque haya empezado hace cinco días.
        expect(phaseOf('2026-05-05', '2026-05-09')).toBe('after')
    })

    it('cierra recién cuando pasaron los días configurados desde el último día', () => {
        expect(phaseOf('2026-05-01', '2026-05-07')).toBe('closed')
    })

    it('ignora un end_date anterior al start_date en vez de romper, tratándolo como show de un día', () => {
        const window = resolveShowModeWindow(
            { startDate: '2026-05-10', endDate: '2026-05-01' },
            prefs,
            NOW
        )
        expect(window.phase).toBe('during')
        expect(window.isMultiDay).toBe(false)
    })

    it('trata un end_date nulo como show de un solo día', () => {
        const window = resolveShowModeWindow({ startDate: '2026-05-10', endDate: null }, prefs, NOW)
        expect(window.isMultiDay).toBe(false)
        expect(window.phase).toBe('during')
    })
})

describe('resolveShowModeWindow — preferencias del usuario', () => {
    it('respeta una ventana más larga que el default', () => {
        const window = resolveShowModeWindow(
            { startDate: '2026-05-30' },
            { daysBefore: 30, daysAfter: 2 },
            NOW
        )
        expect(window.phase).toBe('before')
    })

    it('con la ventana previa en cero, el modo recién arranca el día del show', () => {
        const zeroBefore = { daysBefore: 0, daysAfter: 2 }
        expect(resolveShowModeWindow({ startDate: '2026-05-11' }, zeroBefore, NOW).phase).toBe('upcoming')
        expect(resolveShowModeWindow({ startDate: '2026-05-10' }, zeroBefore, NOW).phase).toBe('during')
    })

    it('con la ventana posterior en cero, cierra apenas termina el show', () => {
        const zeroAfter = { daysBefore: 7, daysAfter: 0 }
        expect(resolveShowModeWindow({ startDate: '2026-05-09' }, zeroAfter, NOW).phase).toBe('closed')
    })

    it('devuelve isActive solo en before/during/after', () => {
        expect(resolveShowModeWindow({ startDate: '2026-05-12' }, prefs, NOW).isActive).toBe(true)
        expect(resolveShowModeWindow({ startDate: '2026-05-10' }, prefs, NOW).isActive).toBe(true)
        expect(resolveShowModeWindow({ startDate: '2026-05-09' }, prefs, NOW).isActive).toBe(true)
        expect(resolveShowModeWindow({ startDate: '2026-06-30' }, prefs, NOW).isActive).toBe(false)
        expect(resolveShowModeWindow({ startDate: '2026-01-01' }, prefs, NOW).isActive).toBe(false)
    })

    it('expone la configuración con la que se resolvió, para poder mostrarla en la UI', () => {
        const window = resolveShowModeWindow({ startDate: '2026-05-12' }, prefs, NOW)
        expect(window.preferences).toEqual(prefs)
    })
})

describe('describeShowModePhase', () => {
    function labelFor(startDate: string, endDate?: string | null) {
        const window = resolveShowModeWindow({ startDate, endDate }, prefs, NOW)
        return describeShowModePhase(window)
    }

    it('cuenta los días que faltan', () => {
        expect(labelFor('2026-05-13')).toBe('Faltan 3 días')
    })

    it('dice "Es mañana" en singular en vez de "Falta 1 días"', () => {
        expect(labelFor('2026-05-11')).toBe('Es mañana')
    })

    it('dice "Es hoy" para un show de un día que es hoy', () => {
        expect(labelFor('2026-05-10')).toBe('Es hoy')
    })

    it('dice "Está pasando" para un festival en curso, que dura más de un día', () => {
        expect(labelFor('2026-05-08', '2026-05-12')).toBe('Está pasando')
    })

    it('dice "Fue ayer" en vez de "Fue hace 1 días"', () => {
        expect(labelFor('2026-05-09')).toBe('Fue ayer')
    })

    it('cuenta los días desde que terminó', () => {
        expect(labelFor('2026-05-08')).toBe('Fue hace 2 días')
    })

    it('no devuelve etiqueta cuando el modo no está activo', () => {
        expect(labelFor('2026-06-30')).toBeNull()
        expect(labelFor('2026-01-01')).toBeNull()
    })
})
