import { describe, it, expect, vi } from 'vitest'
import { CombinedError } from 'urql'
import { toSendResult, makeSender } from './send'
import { EXPENSES_AUTH_REQUIRED_MESSAGE } from '@/src/domains/expenses/messages'
import { TRANSPORT_ERROR_MESSAGE, MALFORMED_RESPONSE_MESSAGE } from '@/src/graphql/mutation-result'
import { transportError } from '@/src/graphql/transport-failure.testing'

describe('toSendResult', () => {
  it('maps a created expense to ok', () => {
    expect(toSendResult({ data: { createExpense: { id: 'x1' } } })).toEqual({ ok: true, id: 'x1' })
  })

  it('maps a network error to kind "network"', () => {
    expect(toSendResult({ data: undefined, error: transportError() })).toEqual({
      ok: false,
      kind: 'network',
      message: TRANSPORT_ERROR_MESSAGE,
    })
  })

  it('treats a missing result as a network failure', () => {
    expect(toSendResult(undefined)).toMatchObject({ ok: false, kind: 'network' })
  })

  it('maps GraphQL-level errors (no network error) to "rejected", not a retry loop', () => {
    const error = new CombinedError({ graphQLErrors: ['Unknown field'] })
    expect(toSendResult({ data: undefined, error })).toEqual({
      ok: false,
      kind: 'rejected',
      message: MALFORMED_RESPONSE_MESSAGE,
    })
  })

  it('maps the not-signed-in message to kind "auth"', () => {
    expect(toSendResult({ data: { createExpense: { error: EXPENSES_AUTH_REQUIRED_MESSAGE } } })).toEqual({
      ok: false,
      kind: 'auth',
      message: EXPENSES_AUTH_REQUIRED_MESSAGE,
    })
  })

  it('maps any other business error to "rejected"', () => {
    expect(toSendResult({ data: { createExpense: { error: 'El monto debe ser mayor a 0.' } } })).toEqual({
      ok: false,
      kind: 'rejected',
      message: 'El monto debe ser mayor a 0.',
    })
  })

  it('maps a payload without id or error to "rejected"', () => {
    expect(toSendResult({ data: { createExpense: {} } })).toMatchObject({ ok: false, kind: 'rejected' })
  })
})

describe('makeSender', () => {
  it('sends the payload plus the entry clientId as input', async () => {
    const execute = vi.fn().mockResolvedValue({ data: { createExpense: { id: 'x1' } } })
    const send = makeSender(execute)

    const result = await send({
      clientId: 'c-1',
      ownerId: 'user-1',
      payload: { amount: 5, category: 'Entrada', date: '2024-01-01' },
      createdAt: 1,
      status: 'pending',
    })

    expect(execute).toHaveBeenCalledWith({
      input: { amount: 5, category: 'Entrada', date: '2024-01-01', clientId: 'c-1' },
    })
    expect(result).toEqual({ ok: true, id: 'x1' })
  })
})
