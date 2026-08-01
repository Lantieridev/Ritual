'use client'

import { useEffect } from 'react'
import { Button } from '@/src/core/components/ui'
import { routes } from '@/src/core/lib/routes'
import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Error boundary global: captura errores en la app y muestra mensaje + opción de reintentar.
 */
export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <main className="min-h-screen bg-ritual-bg text-ritual-bone p-6 md:p-8 flex flex-col items-center justify-center gap-6">
      <p className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-red">Se cortó la luz</p>
      <h1 className="font-display text-4xl uppercase text-ritual-bone text-center">Algo salió mal</h1>
      <p className="font-body text-sm text-ritual-gray-mid text-center max-w-md">
        {error.message || 'Ocurrió un error inesperado.'}
      </p>
      <div className="flex gap-3">
        <Button type="button" variant="primary" onClick={reset}>
          Reintentar
        </Button>
        <Link href={routes.home}>
          <Button type="button" variant="secondary">
            Volver al inicio
          </Button>
        </Link>
      </div>
    </main>
  )
}
