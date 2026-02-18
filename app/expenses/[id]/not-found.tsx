import Link from 'next/link'
import { routes } from '@/src/core/lib/routes'

export default function ExpenseNotFound() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6 md:p-8 font-sans flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold text-zinc-400">Gasto no encontrado</h1>
      <p className="text-zinc-500 text-center max-w-sm">
        El enlace puede estar roto o el gasto ya no existe.
      </p>
      <Link href={routes.expenses.list} className="inline-flex items-center justify-center rounded-lg font-medium bg-white text-neutral-950 hover:bg-zinc-200 px-6 py-2.5 transition-colors">
        Volver a gastos
      </Link>
    </main>
  )
}
