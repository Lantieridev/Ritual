'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, FormField, inputClass } from '@/src/components/ui'
import { routes } from '@/src/lib/routes'
import type {
  Venue,
  EventCreateInput,
  EventUpdateInput,
  EventWithRelations,
  Artist,
} from '@/src/lib/types'

type CreateSubmit = (data: EventCreateInput) => Promise<{ error?: string }>
type UpdateSubmit = (id: string, data: EventUpdateInput) => Promise<{ error?: string }>

interface EventFormProps {
  venues: Venue[]
  /** Artistas disponibles para el lineup (crear/editar). */
  artists: Artist[]
  /** Modo crear: se usa createEvent y no se pasa event. */
  createEvent?: CreateSubmit
  /** Modo editar: se pasa event y updateEvent. */
  event?: EventWithRelations
  updateEvent?: UpdateSubmit
}

/**
 * Formulario unificado para crear o editar un recital (incl. lineup).
 * Client Component: estado local, validación básica; la mutación la hacen Server Actions.
 */
export function EventForm({
  venues,
  artists,
  createEvent: createEventFn,
  event,
  updateEvent: updateEventFn,
}: EventFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  /** IDs de artistas seleccionados para el lineup (controlado por checkboxes). */
  const [selectedArtistIds, setSelectedArtistIds] = useState<Set<string>>(() => {
    if (event?.lineups?.length) {
      return new Set(event.lineups.map((row) => row.artists.id))
    }
    return new Set()
  })

  const isEdit = Boolean(event?.id && updateEventFn)

  function toggleArtist(id: string) {
    setSelectedArtistIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const form = e.currentTarget
    const name = (form.elements.namedItem('name') as HTMLInputElement).value
    const date = (form.elements.namedItem('date') as HTMLInputElement).value
    const venue_id = (form.elements.namedItem('venue_id') as HTMLSelectElement).value
    const artist_ids = Array.from(selectedArtistIds)

    if (isEdit && event) {
      const result = await updateEventFn!(event.id, {
        name,
        date,
        venue_id,
        artist_ids,
      })
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
        <div
          role="alert"
          className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm"
        >
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
        <input
          id="date"
          name="date"
          type="date"
          required
          defaultValue={event?.date ? event.date.slice(0, 10) : ''}
          className={inputClass}
        />
      </FormField>

      <FormField
        label="Sede"
        id="venue_id"
        required
        hint={
          venues.length === 0
            ? 'No hay sedes cargadas. Agregá una sede desde el listado de sedes.'
            : undefined
        }
      >
        <select
          id="venue_id"
          name="venue_id"
          required
          defaultValue={event?.venue_id ?? ''}
          className={inputClass}
        >
          <option value="">Elegir sede...</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.city ? `, ${v.city}` : ''}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="Artistas en el lineup"
        id="lineup-artists"
        hint={
          artists.length === 0
            ? 'No hay artistas cargados. Agregá artistas desde el listado para poder armar lineups.'
            : undefined
        }
      >
        {artists.length === 0 ? (
          <span id="lineup-artists" className="text-zinc-500" />
        ) : (
          <div
            className="max-h-48 overflow-y-auto rounded-lg border border-white/20 bg-white/5 p-3 space-y-2"
            role="group"
            aria-label="Seleccionar artistas"
          >
            {artists.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-2 cursor-pointer text-sm text-white hover:bg-white/5 rounded px-2 py-1"
              >
                <input
                  type="checkbox"
                  checked={selectedArtistIds.has(a.id)}
                  onChange={() => toggleArtist(a.id)}
                  className="rounded border-white/30 bg-white/5 text-yellow-500 focus:ring-yellow-500/50"
                />
                <span>{a.name}</span>
                {a.genre && <span className="text-zinc-500">· {a.genre}</span>}
              </label>
            ))}
          </div>
        )}
      </FormField>

      <div className="flex gap-3 pt-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear recital'}
        </Button>
        <Link
          href={cancelHref}
          className="inline-flex items-center justify-center rounded-lg font-medium border border-white/20 text-white hover:border-yellow-500/50 hover:bg-white/5 px-6 py-2.5 transition-colors"
        >
          Cancelar
        </Link>
      </div>
    </form>
  )
}
