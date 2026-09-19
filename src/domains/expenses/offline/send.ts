import {
  MALFORMED_RESPONSE_MESSAGE,
  TRANSPORT_ERROR_MESSAGE,
  unwrapMutation,
  type UrqlMutationResult,
} from '@/src/graphql/mutation-result'
import { EXPENSES_AUTH_REQUIRED_MESSAGE } from '@/src/domains/expenses/messages'
import type { SendExpense, SendResult } from './sync'

/** Collapses an urql `createExpense` result into what the flusher branches on. */
export function toSendResult(result: UrqlMutationResult | null | undefined): SendResult {
  if (!result) return { ok: false, kind: 'network', message: TRANSPORT_ERROR_MESSAGE }

  if (result.error) {
    // urql sets networkError only when the request never produced a GraphQL
    // response. GraphQL-level errors mean the server understood and refused —
    // retrying would loop forever, so surface them as rejected.
    const isNetwork = Boolean((result.error as { networkError?: unknown }).networkError)
    return isNetwork
      ? { ok: false, kind: 'network', message: TRANSPORT_ERROR_MESSAGE }
      : { ok: false, kind: 'rejected', message: MALFORMED_RESPONSE_MESSAGE }
  }

  const payload = unwrapMutation<{ id?: string; error?: string }>(result, 'createExpense')
  if (payload.error) {
    return {
      ok: false,
      kind: payload.error === EXPENSES_AUTH_REQUIRED_MESSAGE ? 'auth' : 'rejected',
      message: payload.error,
    }
  }
  return payload.id
    ? { ok: true, id: payload.id }
    : { ok: false, kind: 'rejected', message: MALFORMED_RESPONSE_MESSAGE }
}

/** Builds the `send` the flusher and the create hook share, from urql's executor. */
export function makeSender(
  execute: (vars: { input: Record<string, unknown> }) => Promise<UrqlMutationResult>
): SendExpense {
  return async (entry) =>
    toSendResult(await execute({ input: { ...entry.payload, clientId: entry.clientId } }))
}
