'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, FormField, inputClass, Combobox, type ComboboxOption } from '@/src/core/components/ui'
import { routes } from '@/src/core/lib/routes'
import type {
  Venue,
  EventCreateInput,
  EventUpdateInput,
  EventWithRelations,
  Artist,
} from '@/src/core/types'

type CreateSubmit = (data: EventCreateInput) => Promise<{ error?: string }>
type UpdateSubmit = (id: string, data: EventUpdateInput) => Promise<{ error?: string }>
type FindOrCreateVenue = (name: string) => Promise<{ error?: string; id?: string }>
type FindOrCreateArtist = (name: string) => Promise<{ error?: string; id?: string }>

interface EventFormProps {
  venues: Venue[]
  artists: Artist[]
  createEvent?: CreateSubmit
  event?: EventWithRelations
  updateEvent?: UpdateSubmit
  // Recibidas como prop, no importadas directo: un Client Component no
  // puede importar un módulo 'use server' que arrastre 'server-only' vía
  // core/auth/session.ts (mismo patrón que createEvent/updateEvent).
  findOrCreateVenue: FindOrCreateVenue
  findOrCreateArtist: FindOrCreateArtist
}

function toOption(v: { id: string; name: string; city?: string | null }): ComboboxOption {
  return { id: v.id, label: v.name, sublabel: v.city ?? undefined }
}

export function EventForm({
  venues,
  artists,
  createEvent: createEventFn,
  event,
  updateEvent: updateEventFn,
  findOrCreateVenue,
  findOrCreateArtist,
}: EventFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [venueOptions, setVenueOptions] = useState<ComboboxOption[]>(() => venues.map(toOption))
  const [selectedVenue, setSelectedVenue] = useState<ComboboxOption | null>(() => {
    if (!event?.venue_id) return null
    const v = venues.find((x) => x.id === event.venue_id)
    return v ? toOption(v) : null
  })

  const [artistOptions, setArtistOptions] = useState<ComboboxOption[]>(() =>
    artists.map((a) => ({ id: a.id, label: a.name, sublabel: a.genre ?? undefined }))
  )
  const [selectedArtists, setSelectedArtists] = useState<ComboboxOption[]>(() => {
    if (!event?.lineups?.length) return []
    return event.lineups.map((row) => ({ id: row.artists.id, label: row.artists.name, sublabel: row.artists.genre ?? undefined }))
  })

  const isEdit = Boolean(event?.id && updateEventFn)

  function addArtist(option: ComboboxOption) {
    setSelectedArtists((prev) => (prev.some((a) => a.id === option.id) ? prev : [...prev, option]))
  }

  function removeArtist(id: string) {
    setSelectedArtists((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleCreateVenue(name: string) {
    const result = await findOrCreateVenue(name)
    if (result.error || !result.id) return { error: result.error ?? 'No se pudo crear la sede.' }
    const option: ComboboxOption = { id: result.id, label: name }
    setVenueOptions((prev) => (prev.some((v) => v.id === option.id) ? prev : [...prev, option]))
    return option
  }

  async function handleCreateArtist(name: string) {
    const result = await findOrCreateArtist(name)
    if (result.error || !result.id) return { error: result.error ?? 'No se pudo crear el artista.' }
    const option: ComboboxOption = { id: result.id, label: name }
    setArtistOptions((prev) => (prev.some((a) => a.id === option.id) ? prev : [...prev, option]))
    return option
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!selectedVenue) {
      setError('Debes elegir una sede.')
      return
    }

    setIsSubmitting(true)
    const form = e.currentTarget
    const name = (form.elements.namedItem('name') as HTMLInputElement).value
    const date = (form.elements.namedItem('date') as HTMLInputElement).value
    const venue_id = selectedVenue.id
    const artist_ids = selectedArtists.map((a) => a.id)

    if (isEdit && event) {
      const result = await updateEventFn!(event.id, { name, date, venue_id, artist_ids })
      if (result?.error) {
        setError(result.error)
        setIsSubmitting(false)
      }
      return
    }
    if (createEventFn) {
      const result = await createEventFn({ name, date, venue_id, artist_ids })
      if (result?.error) {
        setError(result.error)
        setIsSubmitting(false)
      }
    }
  }

  const cancelHref = isEdit && event ? routes.events.detail(event.id) : routes.home

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      {error && (
        <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      <FormField label="Nombre del recital" id="name" required>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={event?.name ?? ''}
          placeholder="Ej: Coldplay en Movistar Arena"
          className={inputClass}
        />
      </FormField>
      <FormField label="Fecha" id="date" required>
        <input id="date" name="date" type="date" required defaultValue={event?.date ? event.date.slice(0, 10) : ''} className={inputClass} />
      </FormField>
      <FormField label="Sede" id="venue-combobox" required>
        {selectedVenue ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5">
            <span className="text-sm text-white truncate">
              {selectedVenue.label}
              {selectedVenue.sublabel && <span className="text-zinc-500"> · {selectedVenue.sublabel}</span>}
            </span>
            <button
              type="button"
              onClick={() => setSelectedVenue(null)}
              className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <Combobox
            id="venue-combobox"
            options={venueOptions}
            placeholder="Buscar sede o escribir una nueva..."
            onSelect={setSelectedVenue}
            onCreate={handleCreateVenue}
          />
        )}
      </FormField>
      <FormField label="Artistas en el lineup" id="artist-combobox">
        <div className="space-y-2">
          {selectedArtists.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {selectedArtists.map((a) => (
                <li
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 pl-3 pr-2 py-1 text-sm text-white"
                >
                  {a.label}
                  <button
                    type="button"
                    onClick={() => removeArtist(a.id)}
                    aria-label={`Quitar ${a.label} del lineup`}
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Combobox
            id="artist-combobox"
            options={artistOptions}
            excludeIds={new Set(selectedArtists.map((a) => a.id))}
            placeholder="Buscar artista o escribir uno nuevo..."
            onSelect={addArtist}
            onCreate={handleCreateArtist}
          />
        </div>
      </FormField>
      <div className="flex gap-3 pt-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear recital'}
        </Button>
        <Link href={cancelHref} className="inline-flex items-center justify-center rounded-lg font-medium border border-white/20 text-white hover:border-white/30 hover:bg-white/5 px-6 py-2.5 transition-colors">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
