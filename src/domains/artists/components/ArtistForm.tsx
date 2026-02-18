'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, FormField, inputClass } from '@/src/core/components/ui'
import { routes } from '@/src/core/lib/routes'
import type { ArtistCreateInput } from '@/src/core/types'

interface ArtistFormProps {
  createArtist: (data: ArtistCreateInput) => Promise<{ error?: string }>
}

export function ArtistForm({ createArtist }: ArtistFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const form = e.currentTarget
    const result = await createArtist({
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      genre: (form.elements.namedItem('genre') as HTMLInputElement).value || undefined,
    })
    if (result?.error) {
      setError(result.error)
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      {error && (
        <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm">{error}</div>
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
