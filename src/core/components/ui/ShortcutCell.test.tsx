// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShortcutCell } from '@/src/core/components/ui/ShortcutCell'

describe('ShortcutCell', () => {
    it('renderiza el value y el caption', () => {
        render(<ShortcutCell value="23" caption="este año" href="/stats" />)
        expect(screen.getByText('23')).toBeInTheDocument()
        expect(screen.getByText('este año')).toBeInTheDocument()
    })

    it('es un link al href dado', () => {
        render(<ShortcutCell value="23" caption="este año" href="/stats" />)
        expect(screen.getByRole('link')).toHaveAttribute('href', '/stats')
    })

    it('sin tone, el value queda en bone (color por defecto)', () => {
        render(<ShortcutCell value="147" caption="colección" href="/coleccion" />)
        expect(screen.getByText('147')).toHaveClass('text-ritual-bone')
    })

    it('tone="acento" pinta el value en rojo', () => {
        render(<ShortcutCell value="$412k" caption="gastos" href="/expenses" tone="acento" />)
        expect(screen.getByText('$412k')).toHaveClass('text-ritual-red')
    })

    it('declara el alto mínimo de 104px del área tappable', () => {
        render(<ShortcutCell value="23" caption="este año" href="/stats" />)
        expect(screen.getByRole('link')).toHaveClass('min-h-[104px]')
    })
})
