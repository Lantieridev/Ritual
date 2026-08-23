import { describe, it, expect } from 'vitest'
import { CombinedError } from 'urql'
import {
    unwrapMutation,
    TRANSPORT_ERROR_MESSAGE,
    MALFORMED_RESPONSE_MESSAGE,
} from '@/src/graphql/mutation-result'

const networkFailure = () =>
    new CombinedError({ networkError: new Error('Failed to fetch: connection refused at 10.0.0.1') })

describe('unwrapMutation', () => {
    it('returns the payload with error undefined when the mutation succeeds', () => {
        const result = unwrapMutation<{ id?: string; error?: string }>(
            { data: { createExpense: { id: 'x1' } } },
            'createExpense'
        )
        expect(result).toEqual({ id: 'x1', error: undefined })
    })

    it('passes a business error from the resolver through unchanged', () => {
        const result = unwrapMutation(
            { data: { updateExpense: { error: 'El monto debe ser mayor a 0.' } } },
            'updateExpense'
        )
        expect(result.error).toBe('El monto debe ser mayor a 0.')
    })

    it('keeps the rest of the payload alongside a business error', () => {
        const result = unwrapMutation<{ existingId?: string; error?: string }>(
            { data: { createVenue: { error: 'Ya existe una sede con ese nombre.', existingId: 'v-1' } } },
            'createVenue'
        )
        expect(result.existingId).toBe('v-1')
        expect(result.error).toBe('Ya existe una sede con ese nombre.')
    })

    it('reports a transport failure as an error even though data is undefined', () => {
        const result = unwrapMutation({ data: undefined, error: networkFailure() }, 'deleteExpense')
        expect(result.error).toBe(TRANSPORT_ERROR_MESSAGE)
    })

    it('never leaks the raw network/GraphQL error text to the caller', () => {
        const result = unwrapMutation({ data: undefined, error: networkFailure() }, 'deleteExpense')
        expect(result.error).not.toMatch(/fetch|10\.0\.0\.1|refused/i)
    })

    it('reports a transport failure even when data somehow came back too', () => {
        const result = unwrapMutation(
            { data: { deleteExpense: {} }, error: networkFailure() },
            'deleteExpense'
        )
        expect(result.error).toBe(TRANSPORT_ERROR_MESSAGE)
    })

    it('reports an error when the response has no payload for the field', () => {
        expect(unwrapMutation({ data: {} }, 'deleteExpense').error).toBe(MALFORMED_RESPONSE_MESSAGE)
        expect(unwrapMutation({ data: { deleteExpense: null } }, 'deleteExpense').error).toBe(
            MALFORMED_RESPONSE_MESSAGE
        )
        expect(unwrapMutation(undefined, 'deleteExpense').error).toBe(TRANSPORT_ERROR_MESSAGE)
    })

    it('uses the caller-supplied fallback message for a missing payload', () => {
        const result = unwrapMutation({ data: {} }, 'findOrCreateVenue', 'No se pudo crear la sede.')
        expect(result.error).toBe('No se pudo crear la sede.')
    })

    it('treats a null resolver error as success', () => {
        const result = unwrapMutation<{ inWishlist?: boolean; error?: string }>(
            { data: { toggleWishlist: { inWishlist: true, error: null } } },
            'toggleWishlist'
        )
        expect(result.error).toBeUndefined()
        expect(result.inWishlist).toBe(true)
    })
})
