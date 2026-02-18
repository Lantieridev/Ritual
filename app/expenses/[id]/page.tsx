import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getCurrentUserId } from '@/src/core/lib/auth'
import { getExpenseById } from '@/src/domains/expenses/data'
import { deleteExpense } from '@/src/domains/expenses/actions'
import { routes } from '@/src/core/lib/routes'
import { Card, LinkButton } from '@/src/core/components/ui'
import { DeleteExpenseButton } from '@/src/domains/expenses/components'

interface ExpenseDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ExpenseDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const userId = await getCurrentUserId()
  const expense = await getExpenseById(id, userId)
  if (!expense) return { title: 'Gasto no encontrado | RITUAL' }
  return {
    title: `${expense.category} — $${Number(expense.amount).toLocaleString('es-AR')} | RITUAL`,
    description: expense.note ? expense.note.slice(0, 160) : `Gasto en ${expense.category}`,
  }
}

export default async function ExpenseDetailPage({ params }: ExpenseDetailPageProps) {
  const { id } = await params
  const userId = await getCurrentUserId()
  const expense = await getExpenseById(id, userId)

  if (!expense) notFound()

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6 md:p-8 font-sans">
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <Link href={routes.expenses.list} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
          ← Volver a gastos
        </Link>
        <LinkButton href={routes.expenses.edit(id)} variant="secondary" className="px-4 py-2 text-sm">
          Editar
        </LinkButton>
      </div>
      <article>
        <header className="mb-8">
          <p className="text-sm text-zinc-400 uppercase tracking-widest">
            {new Date(expense.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="text-4xl font-bold text-white mt-1">
            ${Number(expense.amount).toLocaleString('es-AR')}
          </h1>
          <p className="text-zinc-400 mt-2">{expense.category}</p>
        </header>
        <Card className="max-w-xl">
          <div className="space-y-4">
            {expense.note && (
              <div>
                <p className="text-sm text-zinc-400 uppercase tracking-wider">Nota</p>
                <p className="text-white">{expense.note}</p>
              </div>
            )}
            <div className="pt-4 border-t border-white/10">
              <p className="text-sm text-zinc-400 uppercase tracking-wider mb-2">Acciones</p>
              <DeleteExpenseButton expense={expense} deleteExpense={deleteExpense} />
            </div>
          </div>
        </Card>
      </article>
    </main>
  )
}
