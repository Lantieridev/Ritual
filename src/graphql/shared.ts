import { builder } from './builder'

/**
 * Resultado genérico para mutations que no necesitan devolver datos más
 * allá de si funcionó o no (borrar, guardar attendance, vincular) — evita
 * repetir el mismo shape {success, error} en cada dominio.
 */
export const MutationResultRef = builder.objectRef<{ success: boolean; error?: string }>('MutationResult')
MutationResultRef.implement({
    fields: (t) => ({
        success: t.exposeBoolean('success'),
        error: t.exposeString('error', { nullable: true }),
    }),
})

export function toMutationResult(result: { error?: string }): { success: boolean; error?: string } {
    return { success: !result.error, error: result.error }
}
