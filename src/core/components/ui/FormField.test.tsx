// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FormField } from '@/src/core/components/ui/FormField'

describe('FormField', () => {
  it('associates the label with the control via htmlFor/id', () => {
    render(
      <FormField label="Nombre" id="name">
        <input id="name" />
      </FormField>
    )
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument()
  })

  it('shows a required marker only when required', () => {
    const { rerender } = render(
      <FormField label="Nombre" id="name" required>
        <input id="name" />
      </FormField>
    )
    expect(screen.getByText('*')).toBeInTheDocument()

    rerender(
      <FormField label="Nombre" id="name">
        <input id="name" />
      </FormField>
    )
    expect(screen.queryByText('*')).not.toBeInTheDocument()
  })

  it('renders the hint only when provided', () => {
    const { rerender } = render(
      <FormField label="Nombre" id="name" hint="Como aparece en tu perfil">
        <input id="name" />
      </FormField>
    )
    expect(screen.getByText('Como aparece en tu perfil')).toBeInTheDocument()

    rerender(
      <FormField label="Nombre" id="name">
        <input id="name" />
      </FormField>
    )
    expect(screen.queryByText('Como aparece en tu perfil')).not.toBeInTheDocument()
  })
})
