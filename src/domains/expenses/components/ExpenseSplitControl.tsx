'use client'

import { useState } from 'react'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import type { ExpenseSplitUser } from '@/src/domains/expenses/service'

const AddExpenseSplitMutation = gql`
  mutation AddExpenseSplit($expenseId: ID!, $username: String!) {
    addExpenseSplit(expenseId: $expenseId, username: $username) { error userId username }
  }
`
const RemoveExpenseSplitMutation = gql`
  mutation RemoveExpenseSplit($expenseId: ID!, $userId: ID!) {
    removeExpenseSplit(expenseId: $expenseId, userId: $userId) { error }
  }
`

interface ExpenseSplitControlProps {
    expenseId: string
    splits: ExpenseSplitUser[]
    onChange: (splits: ExpenseSplitUser[]) => void
}

/**
 * "Compartir con" de un gasto propio — issue #58. El backend ya valida que
 * el tageado tenga attendance en el mismo evento; acá sólo se muestra el
 * error que devuelva (usuario inexistente, sin attendance, ya compartido).
 */
export function ExpenseSplitControl({ expenseId, splits, onChange }: ExpenseSplitControlProps) {
    const [, addSplit] = useMutation(AddExpenseSplitMutation)
    const [, removeSplit] = useMutation(RemoveExpenseSplitMutation)
    const [username, setUsername] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isPending, setIsPending] = useState(false)

    async function handleAdd(e: React.FormEvent) {
        e.preventDefault()
        const trimmed = username.trim()
        if (!trimmed || isPending) return

        setIsPending(true)
        setError(null)
        const result = await addSplit({ expenseId, username: trimmed })
        const { error: mutError, userId, username: resolvedUsername } = unwrapMutation<{
            error?: string
            userId?: string
            username?: string
        }>(result, 'addExpenseSplit')
        setIsPending(false)

        if (mutError) {
            setError(mutError)
            return
        }
        setUsername('')
        // userId es el real, resuelto por el backend -no lo tipeado: sin
        // esto, sacar este split antes de que la página se refresque
        // mandaría el username como si fuera un user_id y fallaría.
        if (userId) {
            onChange([...splits, { user_id: userId, username: resolvedUsername ?? trimmed }])
        }
    }

    async function handleRemove(userId: string) {
        setError(null)
        const result = await removeSplit({ expenseId, userId })
        const { error: mutError } = unwrapMutation(result, 'removeExpenseSplit')
        if (mutError) {
            setError(mutError)
            return
        }
        onChange(splits.filter((s) => s.user_id !== userId))
    }

    return (
        <div className="pl-0">
            {splits.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {splits.map((s) => (
                        <span
                            key={s.user_id}
                            className="inline-flex items-center gap-1 font-label text-[9px] tracking-[0.1em] uppercase border border-ritual-border px-2 py-1 text-ritual-gray-text"
                        >
                            @{s.username || 'alguien'}
                            <button
                                type="button"
                                onClick={() => handleRemove(s.user_id)}
                                aria-label={`Sacar a ${s.username || 'este usuario'} del split`}
                                className="hover:text-ritual-red-hover transition-colors"
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <form onSubmit={handleAdd} className="flex items-center gap-2">
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Compartir con @usuario"
                    disabled={isPending}
                    className="flex-1 min-w-0 border-0 border-b border-ritual-border-subtle bg-transparent px-0 py-1 font-label text-[10px] text-ritual-bone placeholder-ritual-gray-mid focus:border-ritual-red focus:outline-none disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={isPending || !username.trim()}
                    className="font-label text-[9px] tracking-[0.1em] uppercase text-ritual-red-hover hover:underline disabled:opacity-50 disabled:no-underline shrink-0"
                >
                    {isPending ? '...' : '+ Compartir'}
                </button>
            </form>
            {error && (
                <p role="alert" className="font-label text-[10px] text-ritual-red-hover mt-1">
                    {error}
                </p>
            )}
        </div>
    )
}
