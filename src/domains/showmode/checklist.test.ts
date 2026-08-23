import { describe, it, expect } from 'vitest'
import { buildEventChecklist, checklistProgress } from '@/src/domains/showmode/checklist'
import type {
    ChecklistTemplateItem,
    EventChecklistItem,
    EventChecklistCheck,
} from '@/src/domains/showmode/checklist'

const template: ChecklistTemplateItem[] = [
    { id: 't-2', label: 'Efectivo', position: 1 },
    { id: 't-1', label: 'Entrada en el celular', position: 0 },
]

const adHoc: EventChecklistItem[] = [
    { id: 'a-1', label: 'Cargar la SUBE', position: 0, checked: false },
]

describe('buildEventChecklist', () => {
    it('pone la plantilla primero y los ítems del show después', () => {
        const result = buildEventChecklist(template, adHoc, [])
        expect(result.map((i) => i.label)).toEqual([
            'Entrada en el celular',
            'Efectivo',
            'Cargar la SUBE',
        ])
    })

    it('ordena cada bloque por position, no por el orden en que llegaron', () => {
        const result = buildEventChecklist(template, [], [])
        expect(result.map((i) => i.id)).toEqual(['t-1', 't-2'])
    })

    it('marca el origen de cada ítem para que la UI sepa cuál se puede borrar desde el show', () => {
        const result = buildEventChecklist(template, adHoc, [])
        expect(result.filter((i) => i.source === 'template')).toHaveLength(2)
        expect(result.filter((i) => i.source === 'adhoc')).toHaveLength(1)
    })

    it('aplica el tilde de un ítem de plantilla solo al show que lo tiene tildado', () => {
        const checks: EventChecklistCheck[] = [{ templateItemId: 't-1', checked: true }]
        const result = buildEventChecklist(template, [], checks)
        expect(result.find((i) => i.id === 't-1')?.checked).toBe(true)
        expect(result.find((i) => i.id === 't-2')?.checked).toBe(false)
    })

    it('trata un ítem de plantilla sin fila de tilde como no tildado (es el estado inicial normal)', () => {
        const result = buildEventChecklist(template, [], [])
        expect(result.every((i) => !i.checked)).toBe(true)
    })

    it('respeta una fila de tilde explícitamente en false (el usuario destildó algo que había tildado)', () => {
        const checks: EventChecklistCheck[] = [{ templateItemId: 't-1', checked: false }]
        const result = buildEventChecklist(template, [], checks)
        expect(result.find((i) => i.id === 't-1')?.checked).toBe(false)
    })

    it('ignora un tilde que apunta a un ítem de plantilla que ya no existe', () => {
        const checks: EventChecklistCheck[] = [{ templateItemId: 't-borrado', checked: true }]
        const result = buildEventChecklist(template, [], checks)
        expect(result).toHaveLength(2)
        expect(result.every((i) => !i.checked)).toBe(true)
    })

    it('toma el tilde de un ítem ad-hoc de su propia fila, no de la tabla de tildes', () => {
        const checkedAdHoc: EventChecklistItem[] = [
            { id: 'a-1', label: 'Cargar la SUBE', position: 0, checked: true },
        ]
        const result = buildEventChecklist([], checkedAdHoc, [])
        expect(result[0].checked).toBe(true)
    })

    it('no muta los arrays que recibe al ordenarlos', () => {
        const original = [...template]
        buildEventChecklist(template, adHoc, [])
        expect(template).toEqual(original)
    })

    it('devuelve una lista vacía cuando no hay ni plantilla ni ítems del show', () => {
        expect(buildEventChecklist([], [], [])).toEqual([])
    })
})

describe('checklistProgress', () => {
    it('cuenta cuántos ítems están tildados sobre el total', () => {
        const items = buildEventChecklist(template, adHoc, [{ templateItemId: 't-1', checked: true }])
        expect(checklistProgress(items)).toEqual({
            done: 1,
            total: 3,
            ratio: 1 / 3,
            isComplete: false,
        })
    })

    it('marca la lista completa cuando está todo tildado', () => {
        const items = buildEventChecklist(
            template,
            [{ id: 'a-1', label: 'Cargar la SUBE', position: 0, checked: true }],
            [
                { templateItemId: 't-1', checked: true },
                { templateItemId: 't-2', checked: true },
            ]
        )
        expect(checklistProgress(items).isComplete).toBe(true)
    })

    it('una lista vacía da ratio 0 y nunca cuenta como completa (evita el NaN de 0/0)', () => {
        expect(checklistProgress([])).toEqual({ done: 0, total: 0, ratio: 0, isComplete: false })
    })
})
