// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const addSplitMock = vi.fn()
const removeSplitMock = vi.fn()

vi.mock('urql', async () => {
    const actual = await vi.importActual<typeof import('urql')>('urql')
    return {
        ...actual,
        useMutation: (doc: { definitions?: Array<{ name?: { value?: string } }> }) => {
            const name = doc.definitions?.[0]?.name?.value
            if (name === 'RemoveExpenseSplit') return [{ fetching: false }, removeSplitMock]
            return [{ fetching: false }, addSplitMock]
        },
    }
})

import { ExpenseSplitControl } from './ExpenseSplitControl'

describe('ExpenseSplitControl', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        addSplitMock.mockResolvedValue({
            data: { addExpenseSplit: { error: null, userId: 'u2', username: 'lucia' } },
        })
        removeSplitMock.mockResolvedValue({ data: { removeExpenseSplit: { error: null } } })
    })

    it('adds a split with the real resolved user_id, not the typed username', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()

        render(<ExpenseSplitControl expenseId="ex1" splits={[]} onChange={onChange} />)

        await user.type(screen.getByPlaceholderText('Compartir con @usuario'), 'lucia')
        await user.click(screen.getByRole('button', { name: '+ Compartir' }))

        await waitFor(() => {
            expect(addSplitMock).toHaveBeenCalledWith({ expenseId: 'ex1', username: 'lucia' })
        })
        expect(onChange).toHaveBeenCalledWith([{ user_id: 'u2', username: 'lucia' }])
    })

    it('shows the backend error and does not call onChange when the split cannot be added', async () => {
        addSplitMock.mockResolvedValue({
            data: { addExpenseSplit: { error: '"lucia" no tiene marcada su asistencia a este show.', userId: null, username: null } },
        })
        const user = userEvent.setup()
        const onChange = vi.fn()

        render(<ExpenseSplitControl expenseId="ex1" splits={[]} onChange={onChange} />)

        await user.type(screen.getByPlaceholderText('Compartir con @usuario'), 'lucia')
        await user.click(screen.getByRole('button', { name: '+ Compartir' }))

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('no tiene marcada su asistencia')
        })
        expect(onChange).not.toHaveBeenCalled()
    })

    it('removes an existing split and reports it via onChange', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()

        render(
            <ExpenseSplitControl
                expenseId="ex1"
                splits={[{ user_id: 'u2', username: 'lucia' }]}
                onChange={onChange}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Sacar a lucia del split' }))

        await waitFor(() => {
            expect(removeSplitMock).toHaveBeenCalledWith({ expenseId: 'ex1', userId: 'u2' })
        })
        expect(onChange).toHaveBeenCalledWith([])
    })
})
