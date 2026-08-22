'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import NextError from 'next/error'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="es">
      <body className="min-h-screen bg-ritual-bg text-ritual-bone p-6 md:p-8 flex flex-col items-center justify-center gap-6">
        <NextError statusCode={500} title="Algo salió mal a nivel global" />
      </body>
    </html>
  )
}
