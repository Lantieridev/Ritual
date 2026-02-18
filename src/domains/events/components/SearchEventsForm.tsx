'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/src/core/components/ui'
import { FormField } from '@/src/core/components/ui'
interface SearchEventsFormProps {
  configured: boolean
  initialArtist?: string
  initialLocation?: string
}

/**
 * Formulario para buscar por artista o por ubicación. Redirige a /buscar?artist=... o ?location=...
 */
export function SearchEventsForm({
  configured,
  initialArtist = '',
  initialLocation = '',
}: SearchEventsFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'artist' | 'location'>(initialArtist ? 'artist' : 'location')
  const [artist, setArtist] = useState(initialArtist)
  const [location, setLocation] = useState(initialLocation)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    params.delete('artist')
    params.delete('location')
    if (mode === 'artist' && artist.trim()) {
      params.set('artist', artist.trim())
    } else if (mode === 'location' && location.trim()) {
      params.set('location', location.trim())
    }
    router.push(`/buscar?${params.toString()}`)
  }

  if (!configured) return null

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setMode('artist')}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${mode === 'artist' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Por artista
        </button>
        <button
          type="button"
          onClick={() => setMode('location')}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${mode === 'location' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Por ciudad
        </button>
      </div>

      {mode === 'artist' ? (
        <FormField label="Nombre del artista" id="artist">
          <input
            type="text"
            id="artist"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="ej. Radiohead"
            className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </FormField>
      ) : (
        <FormField label="Ciudad o ubicación" id="location">
          <input
            type="text"
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="ej. Buenos Aires, Argentina"
            className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </FormField>
      )}

      <Button type="submit" variant="primary">
        Buscar
      </Button>
    </form>
  )
}
