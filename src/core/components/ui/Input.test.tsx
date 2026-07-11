// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/src/core/components/ui/Input'

describe('Input', () => {
  it('renders a label associated with the input via id', () => {
    render(<Input id="username" label="Usuario" />)
    expect(screen.getByLabelText('Usuario')).toBeInTheDocument()
  })

  it('omits the label element when none is provided', () => {
    render(<Input id="username" />)
    expect(screen.queryByRole('textbox')).toBeInTheDocument()
    expect(document.querySelector('label')).not.toBeInTheDocument()
  })

  it('shows the error message and applies error styling', () => {
    render(<Input id="username" error="Usuario obligatorio" />)
    expect(screen.getByText('Usuario obligatorio')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveClass('border-red-500')
  })

  it('forwards typing to the underlying input', async () => {
    const onChange = vi.fn()
    render(<Input id="username" onChange={onChange} />)

    await userEvent.type(screen.getByRole('textbox'), 'martin')

    expect(onChange).toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveValue('martin')
  })

  it('forwards a ref to the underlying input element', () => {
    let ref: HTMLInputElement | null = null
    render(
      <Input
        id="username"
        ref={(el) => {
          ref = el
        }}
      />
    )
    expect(ref).toBeInstanceOf(HTMLInputElement)
  })
})
