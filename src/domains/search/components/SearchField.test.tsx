// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SearchField } from '@/src/domains/search/components/SearchField'
import { routes } from '@/src/core/lib/routes'

describe('SearchField', () => {
  it('renders a GET form to /buscar with the exact placeholder copy', () => {
    render(<SearchField defaultValue="" filter="todo" />)

    const input = screen.getByPlaceholderText('artista, sede, festival')
    expect(input).toHaveAttribute('type', 'search')
    expect(input).toHaveAttribute('name', 'q')

    const form = input.closest('form')
    expect(form).toHaveAttribute('method', 'GET')
    expect(form).toHaveAttribute('action', routes.events.search)
  })

  it('carries the active filter and current query as hidden inputs (tab=archivo always set)', () => {
    render(<SearchField defaultValue="obras" filter="artistas" />)

    const input = screen.getByPlaceholderText('artista, sede, festival') as HTMLInputElement
    expect(input.value).toBe('obras')

    const form = input.closest('form') as HTMLFormElement
    const tabInput = form.querySelector('input[name="tab"]') as HTMLInputElement
    const filtroInput = form.querySelector('input[name="filtro"]') as HTMLInputElement
    expect(tabInput.value).toBe('archivo')
    expect(tabInput.type).toBe('hidden')
    expect(filtroInput.value).toBe('artistas')
    expect(filtroInput.type).toBe('hidden')
  })
})
