'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/src/components/ui'
import type { Venue, EventCreateInput } from '@/src/lib/types'

interface EventFormProps {
  venues: Venue[]
  createEvent: (data: EventCreateInput) => Promise<{ error?: string }>
}

/**
 * Formulario para cargar un recital manualmente.
 * Client Component: maneja estado (inputs, submitting, error).
 * La mutación real la hace la Server Action recibida por props.
 */
export function EventForm({ venues, createEvent }: EventFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const form = e.currentTarget
    const formData: EventCreateInput = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      date: (form.elements.namedItem('date') as HTMLInputElement).value,
      venue_id: (form.elements.namedItem('venue_id') as HTMLSelectElement).value,
    }

    const result = await createEvent(formData)
    if (result?.error) {
      setError(result.error)
      setIsSubmitting(false)
    }
    // Si no hay error, createEvent hace redirect y no llegamos aquí
  }

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

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-400 mb-1.5">
          Nombre del recital
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Ej: Coldplay en Movistar Arena"
          className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
        />
      </div>

      <div>
        <label htmlFor="date" className="block text-sm font-medium text-zinc-400 mb-1.5">
          Fecha
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
        />
      </div>

      <div>
        <label htmlFor="venue_id" className="block text-sm font-medium text-zinc-400 mb-1.5">
          Sede
        </label>
        <select
          id="venue_id"
          name="venue_id"
          required
          className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
        >
          <option value="">Elegir sede...</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.city ? `, ${v.city}` : ''}
            </option>
          ))}
        </select>
        {venues.length === 0 && (
          <p className="mt-1.5 text-sm text-zinc-500">
            No hay sedes cargadas. Agregá primero una sede en Supabase.
          </p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Crear recital'}
        </Button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg font-medium border border-white/20 text-white hover:border-yellow-500/50 hover:bg-white/5 px-6 py-2.5 transition-colors"
        >
          Cancelar
        </Link>
      </div>
    </form>
  )
}
