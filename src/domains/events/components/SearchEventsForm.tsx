'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/src/core/components/ui'
import { FormField } from '@/src/core/components/ui'

interface SearchEventsFormProps {
  configured: boolean
  initialArtist?: string
  initialLocation?: string
  showLocationTab?: boolean
  source?: 'future' | 'past'
}

/**
 * Formulario de búsqueda multi-fuente.
 * - source=future: busca por artista o ciudad (Ticketmaster)
 * - source=past: solo busca por artista (Setlist.fm no tiene búsqueda por ciudad)
 */
export function SearchEventsForm({
  configured,
  initialArtist = '',
  initialLocation = '',
  showLocationTab = true,
  source = 'future',
}: SearchEventsFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const canSearchByLocation = showLocationTab && source === 'future'
  const [mode, setMode] = useState<'artist' | 'location'>(
    initialArtist || !canSearchByLocation ? 'artist' : 'location'
  )
  const [artist, setArtist] = useState(initialArtist)
  const [location, setLocation] = useState(initialLocation)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    params.delete('artist')
    params.delete('location')
    params.set('source', source)
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
      {/* Tabs de modo (solo si hay búsqueda por ciudad disponible) */}
      {canSearchByLocation && (
        <div className="flex gap-2 border-b border-white/10 pb-2">
          <button
            type="button"
            onClick={() => setMode('artist')}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${mode === 'artist' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            Por artista
          </button>
          <button
            type="button"
            onClick={() => setMode('location')}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${mode === 'location' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            Por ciudad
          </button>
        </div>
      )}

      {/* Input */}
      {mode === 'artist' || !canSearchByLocation ? (
        <FormField label="Nombre del artista" id="artist">
          <input
            type="text"
            id="artist"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder={source === 'past' ? 'ej. Radiohead (nombre exacto)' : 'ej. Radiohead'}
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
            placeholder="ej. Buenos Aires"
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
