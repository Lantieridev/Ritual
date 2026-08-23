import { CombinedError } from 'urql'

/**
 * El `CombinedError` que devuelve urql cuando la mutation nunca llegó al
 * resolver — red caída, HTTP 500, GraphQL inválido. En ese caso urql resuelve
 * con `{ data: undefined, error: transportError() }`: `data` no existe, así
 * que cualquier chequeo que solo mire `data.<campo>.error` lee la falla como
 * éxito.
 *
 * Solo lo usan los tests; ningún módulo de producción lo importa.
 */
export function transportError(): CombinedError {
    return new CombinedError({ networkError: new Error('Failed to fetch') })
}
