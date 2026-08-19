'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import { GenrePicker } from '@/src/domains/taste/components/GenrePicker'
import { Input } from '@/src/core/components/ui/Input'
import { Button } from '@/src/core/components/ui/Button'
import type { GenreOption } from '@/src/domains/taste/data'

const UpdateTasteProfileMutation = gql`
  mutation UpdateTasteProfile($input: TasteProfileUpdateInput!) {
    updateTasteProfile(input: $input) { error }
  }
`

export interface TasteProfileFormProps {
  genres: readonly GenreOption[]
  defaultGenres?: readonly string[]
  defaultBirthYear?: number | null
}

/**
 * Edita géneros favoritos y año de nacimiento — formulario separado de
 * `LastfmConnect` (cada uno con su propia mutation), igual que `ProfileForm`
 * mantiene una sola escritura por formulario en vez de mezclar varios
 * dominios en un mismo submit.
 */
export function TasteProfileForm({ genres, defaultGenres = [], defaultBirthYear = null }: TasteProfileFormProps) {
    const router = useRouter()
    const [, updateTasteProfile] = useMutation(UpdateTasteProfileMutation)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [isPending, setIsPending] = useState(false)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError(null)
        setSuccess(null)
        setIsPending(true)

        const form = e.currentTarget
        const selectedGenres = new FormData(form).getAll('genres') as string[]
        const birthYearInput = (form.elements.namedItem('birthYear') as HTMLInputElement).value.trim()
        const birthYear = birthYearInput ? Number(birthYearInput) : null

        const result = unwrapMutation(
            await updateTasteProfile({ input: { genres: selectedGenres, birthYear } }),
            'updateTasteProfile',
            'No pudimos guardar tus preferencias.'
        )

        if (result.error) {
            setError(result.error)
            setIsPending(false)
            return
        }

        setSuccess('Preferencias guardadas.')
        setIsPending(false)
        router.refresh()
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
                <label className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-text">
                    Géneros favoritos <span className="normal-case text-ritual-gray-mid">(hasta 5)</span>
                </label>
                <GenrePicker genres={genres} defaultSelected={defaultGenres} />
            </div>

            <Input
                label="Año de nacimiento"
                id="birthYear"
                name="birthYear"
                type="number"
                inputMode="numeric"
                defaultValue={defaultBirthYear ?? ''}
                placeholder="Ej. 1995"
            />

            {error && (
                <div role="alert" className="p-4 bg-ritual-red/10 border border-ritual-red/20 text-ritual-red-hover font-body text-sm">
                    {error}
                </div>
            )}

            {success && (
                <div role="status" className="p-4 bg-ritual-surface border border-ritual-border text-ritual-gray-light-3 font-body text-sm">
                    {success}
                </div>
            )}

            <Button type="submit" disabled={isPending}>
                {isPending ? 'Guardando...' : 'Guardar preferencias'}
            </Button>
        </form>
    )
}
