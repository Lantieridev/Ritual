'use client'

import { useState } from 'react'
import Link from 'next/link'
import { routes } from '@/src/core/lib/routes'

export interface WrappedSlide {
  kind: 'cover' | 'shows' | 'artist' | 'bestNight' | 'venues' | 'expenses' | 'closing'
  content: React.ReactNode
}

interface WrappedStoriesProps {
  slides: WrappedSlide[]
  handle: string
}

/**
 * Visor tipo "historia" para las placas de Wrapped: una a la vez, barra de
 * progreso arriba, navegación por click en los costados o con el teclado
 * (← →), botones "Anterior"/Siguiente" accesibles además del tap silencioso
 * en los costados. Misma pantalla sirve para mobile y escritorio — el
 * handoff pedía un layout de escritorio distinto, pero mantener un único
 * visor de historia es una simplificación deliberada por ahora.
 */
export function WrappedStories({ slides, handle }: WrappedStoriesProps) {
  const [index, setIndex] = useState(0)
  const total = slides.length

  function goTo(next: number) {
    setIndex(Math.max(0, Math.min(total - 1, next)))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') goTo(index + 1)
    if (e.key === 'ArrowLeft') goTo(index - 1)
  }

  return (
    <div
      className="relative mx-auto w-full max-w-sm aspect-[9/16] bg-ritual-panel border border-ritual-border overflow-hidden select-none"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="group"
      aria-roledescription="carousel"
      aria-label="Tu Wrapped, en placas"
    >
      {/* Barra de progreso tipo historia */}
      <div className="absolute top-3 left-3 right-3 z-20 flex gap-1">
        {slides.map((_, i) => (
          <div key={i} className="flex-1 h-[3px] bg-ritual-bone/20">
            <div className={`h-full bg-ritual-bone transition-all ${i < index ? 'w-full' : i === index ? 'w-full' : 'w-0'}`} />
          </div>
        ))}
      </div>
      <p className="absolute top-6 left-3 z-20 font-label text-[9px] tracking-[0.14em] uppercase text-ritual-gray-light-2">@{handle}</p>
      <p className="sr-only" aria-live="polite">Placa {index + 1} de {total}</p>

      {/* Contenido de la placa activa */}
      <div className="absolute inset-0 flex items-center justify-center p-8">{slides[index].content}</div>

      {/* Zonas de navegación silenciosas + botones accesibles */}
      <button
        type="button"
        onClick={() => goTo(index - 1)}
        disabled={index === 0}
        aria-label="Placa anterior"
        className="absolute left-0 top-0 bottom-0 w-1/3 z-10 disabled:cursor-default"
      />
      <button
        type="button"
        onClick={() => goTo(index + 1)}
        disabled={index === total - 1}
        aria-label="Placa siguiente"
        className="absolute right-0 top-0 bottom-0 w-1/3 z-10 disabled:cursor-default"
      />

      <div className="absolute bottom-4 left-0 right-0 z-20 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-light-3 disabled:opacity-30"
        >
          ← Anterior
        </button>
        <Link href={routes.profile} className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-red-hover">
          Ver perfil
        </Link>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index === total - 1}
          className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-light-3 disabled:opacity-30"
        >
          Siguiente →
        </button>
      </div>
    </div>
  )
}
