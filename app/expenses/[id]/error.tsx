'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/src/core/components/ui'
import { routes } from '@/src/core/lib/routes'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ExpenseDetailError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Expense detail error:', error)
  }, [error])

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6 md:p-8 font-sans flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold text-zinc-400">Error al cargar el gasto</h1>
      <p className="text-zinc-500 text-center max-w-md">{error.message || 'Algo falló.'}</p>
      <div className="flex gap-3">
        <Button type="button" variant="primary" onClick={reset}>Reintentar</Button>
        <Link href={routes.expenses.list}><Button type="button" variant="secondary">Volver a gastos</Button></Link>
      </div>
    </main>
  )
}
