'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, FormField, inputClass } from '@/src/core/components/ui'
import { routes } from '@/src/core/lib/routes'
import type { VenueCreateInput } from '@/src/core/types'

interface VenueFormProps {
  createVenue: (data: VenueCreateInput) => Promise<{ error?: string }>
}

export function VenueForm({ createVenue }: VenueFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const form = e.currentTarget
    const result = await createVenue({
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      city: (form.elements.namedItem('city') as HTMLInputElement).value || undefined,
      address: (form.elements.namedItem('address') as HTMLInputElement).value || undefined,
      country: (form.elements.namedItem('country') as HTMLInputElement).value || undefined,
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
      <FormField label="Nombre de la sede" id="name" required>
        <input id="name" name="name" type="text" required placeholder="Ej: Movistar Arena" className={inputClass} />
      </FormField>
      <FormField label="Ciudad" id="city">
        <input id="city" name="city" type="text" placeholder="Ej: Buenos Aires" className={inputClass} />
      </FormField>
      <FormField label="Dirección" id="address">
        <input id="address" name="address" type="text" placeholder="Ej: Av. Corrientes 1234" className={inputClass} />
      </FormField>
      <FormField label="País" id="country">
        <input id="country" name="country" type="text" placeholder="Ej: Argentina" className={inputClass} />
      </FormField>
      <div className="flex gap-3 pt-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Crear sede'}
        </Button>
        <Link href={routes.venues.list} className="inline-flex items-center justify-center rounded-lg font-medium border border-white/20 text-white hover:border-white/30 hover:bg-white/5 px-6 py-2.5 transition-colors">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
