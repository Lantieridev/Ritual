// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tabs } from '@/src/core/components/ui/Tabs'

const tabs = [
  { id: 'overview', label: 'Descripción' },
  { id: 'history', label: 'Historial' },
]

describe('Tabs', () => {
  it('renders a button for every tab', () => {
    render(<Tabs tabs={tabs} activeTab="overview" onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Descripción' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Historial' })).toBeInTheDocument()
  })

  it('calls onChange with the clicked tab id', async () => {
    const onChange = vi.fn()
    render(<Tabs tabs={tabs} activeTab="overview" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Historial' }))

    expect(onChange).toHaveBeenCalledWith('history')
  })

  it('visually distinguishes the active tab from the rest', () => {
    render(<Tabs tabs={tabs} activeTab="history" onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Historial' })).toHaveClass('bg-ritual-red')
    expect(screen.getByRole('button', { name: 'Descripción' })).not.toHaveClass('bg-ritual-red')
  })
})
