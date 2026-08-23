'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import { Button, FormField, inputClass } from '@/src/core/components/ui'
import { routes } from '@/src/core/lib/routes'

const CreateArtistMutation = gql`
  mutation CreateArtist($input: ArtistCreateInput!) {
    createArtist(input: $input) { id existingId error }
  }
`

export function ArtistForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [existingId, setExistingId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, createArtist] = useMutation(CreateArtistMutation)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setExistingId(null)
    setIsSubmitting(true)
    const form = e.currentTarget
    const result = unwrapMutation<{ id?: string; existingId?: string; error?: string }>(
      await createArtist({
        input: {
          name: (form.elements.namedItem('name') as HTMLInputElement).value,
          genre: (form.elements.namedItem('genre') as HTMLInputElement).value || undefined,
        },
      }),
      'createArtist',
      'No se pudo crear el artista.'
    )
    if (result.error) {
      setError(result.error)
      setExistingId(result.existingId ?? null)
      setIsSubmitting(false)
      return
    }
    router.push(routes.artists.list)
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      {error && (
        <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm">
          {error}
          {existingId && (
            <>
              {' '}
              <Link href={routes.artists.detail(existingId)} className="underline underline-offset-2 hover:text-red-300">
                Ver el artista existente →
              </Link>
            </>
          )}
        </div>
      )}
      <FormField label="Nombre del artista" id="name" required>
        <input id="name" name="name" type="text" required placeholder="Ej: Coldplay" className={inputClass} />
      </FormField>
      <FormField label="Género" id="genre">
        <input id="genre" name="genre" type="text" placeholder="Ej: Rock, Pop" className={inputClass} />
      </FormField>
      <div className="flex gap-3 pt-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Crear artista'}
        </Button>
        <Link href={routes.artists.list} className="inline-flex items-center justify-center rounded-lg font-medium border border-white/20 text-white hover:border-white/30 hover:bg-white/5 px-6 py-2.5 transition-colors">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
