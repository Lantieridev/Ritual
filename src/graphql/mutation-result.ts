/**
 * Normalización de resultados de mutations de urql para los client components.
 *
 * Una mutation de urql puede fallar por dos canales independientes:
 *
 * 1. `result.data.<campo>.error` — el resolver corrió y devolvió un error de
 *    negocio ("Ya existe una sede con ese nombre.").
 * 2. `result.error` — la request nunca llegó al resolver: red caída, HTTP 500,
 *    error de validación de GraphQL. En ese caso `result.data` es `undefined`.
 *
 * Mirar solo el primero hace que el segundo se lea como éxito: `data?.x?.error`
 * es `undefined`, el `if (!error)` da verdadero y la UI aplica el cambio
 * optimista (borra la fila, navega, muestra el monto nuevo) sobre algo que el
 * servidor nunca guardó. `unwrapMutation` colapsa los dos canales en la forma
 * `{ error?: string }` que ya esperan los callers, sin descartar el resto del
 * payload (`id`, `existingId`, `inWishlist`, …) que algunos necesitan.
 *
 * Nunca expone el texto crudo del error de red/GraphQL — mismo criterio que
 * `sanitizeError` en las Server Actions: mensajes en castellano, sin detalles
 * internos.
 */

/** La request no llegó al resolver (red, 500, GraphQL inválido). */
export const TRANSPORT_ERROR_MESSAGE =
    'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.'

/** El resolver respondió, pero sin el payload esperado. */
export const MALFORMED_RESPONSE_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.'

/** Todo payload de mutation del esquema expone `error` como campo opcional. */
export interface MutationPayload {
    error?: string | null
}

/**
 * Forma estructural mínima de un `OperationResult` de urql. No importamos el
 * tipo de urql para que el helper siga siendo testeable con objetos planos.
 */
export interface UrqlMutationResult {
    data?: Record<string, unknown> | null
    error?: { message?: string } | null
}

export type UnwrappedMutation<TPayload extends MutationPayload> = Omit<Partial<TPayload>, 'error'> & {
    error?: string
}

/**
 * Devuelve el payload de la mutation con `error` normalizado: string cuando
 * falló por cualquiera de los dos canales, `undefined` cuando salió bien.
 *
 * @param result Lo que resolvió `executeMutation` de urql.
 * @param field Nombre del campo del payload dentro de `data` (ej. `deleteExpense`).
 * @param fallbackMessage Mensaje para cuando el resolver responde sin payload.
 */
export function unwrapMutation<TPayload extends MutationPayload = MutationPayload>(
    result: UrqlMutationResult | null | undefined,
    field: string,
    fallbackMessage: string = MALFORMED_RESPONSE_MESSAGE
): UnwrappedMutation<TPayload> {
    if (!result || result.error) {
        if (process.env.NODE_ENV === 'development' && result?.error?.message) {
            console.error(`[graphql] ${field} falló en transporte:`, result.error.message)
        }
        return { error: TRANSPORT_ERROR_MESSAGE } as UnwrappedMutation<TPayload>
    }

    const payload = result.data?.[field] as TPayload | null | undefined
    if (!payload) {
        return { error: fallbackMessage } as UnwrappedMutation<TPayload>
    }

    const { error, ...rest } = payload
    return { ...rest, error: error ?? undefined } as UnwrappedMutation<TPayload>
}
