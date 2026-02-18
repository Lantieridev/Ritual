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
    <main className="min-h-screen bg-neutral-950 text-white p-6 md:p-8 font-sans flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold text-zinc-400">Algo salió mal</h1>
      <p className="text-zinc-500 text-center max-w-md">
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
