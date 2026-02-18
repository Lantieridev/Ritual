'use client'

import { useState, useTransition } from 'react'
import { Card } from '@/src/core/components/ui'
import { Button } from '@/src/core/components/ui'
import { addEventFromBandsintown } from '@/src/domains/events/actions'
import type { BandsintownEvent } from '@/src/core/lib/bandsintown'

interface BandsintownResultsProps {
  events: BandsintownEvent[]
  searchArtist?: string
}

/**
 * Lista de eventos de Bandsintown con botón "Agregar a mis recitales".
 * Cada card tiene su propio estado de loading independiente (loadingId).
 * Al agregar se crea evento/sede/artista en nuestra DB y se redirige al detalle.
 */
export function BandsintownResults({ events, searchArtist }: BandsintownResultsProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleAdd(bitEvent: BandsintownEvent) {
    setLoadingId(bitEvent.id)
    startTransition(async () => {
      await addEventFromBandsintown(bitEvent, searchArtist)
      setLoadingId(null)
    })
  }

  if (events.length === 0) {
    return (
      <p className="mt-8 text-zinc-500">
        No se encontraron recitales. Probá con otro artista o ciudad.
      </p>
    )
  }

  return (
    <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {events.map((ev) => {
        const venueLabel = [ev.venue?.name, ev.venue?.city, ev.venue?.country]
          .filter(Boolean)
          .join(', ')
        const dateLabel = ev.datetime
          ? new Date(ev.datetime).toLocaleDateString('es-AR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
          : ''

        const isThisLoading = loadingId === ev.id

        return (
          <li key={ev.id}>
            <Card className="flex flex-col gap-4">
              <div>
                <p className="text-sm text-zinc-400 font-medium uppercase tracking-widest">
                  {dateLabel}
                </p>
                <h2 className="text-xl font-bold text-white mt-1">
                  {ev.title || ev.lineup?.[0] || 'Recital'}
                </h2>
              </div>
              <div className="flex items-center gap-2 text-zinc-300 text-sm">
                <span aria-hidden>📍</span>
                <span>{venueLabel || 'Sede por confirmar'}</span>
              </div>
              {ev.lineup && ev.lineup.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {ev.lineup.slice(0, 3).map((name, i) => (
                    <span
                      key={i}
                      className="inline-block bg-white/10 text-zinc-400 text-xs px-2 py-0.5 rounded"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
              <div className="pt-2 border-t border-white/10">
                <Button
                  type="button"
                  variant="primary"
                  className="w-full text-sm"
                  disabled={isThisLoading}
                  onClick={() => handleAdd(ev)}
                >
                  {isThisLoading ? 'Agregando…' : 'Agregar a mis recitales'}
                </Button>
              </div>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
