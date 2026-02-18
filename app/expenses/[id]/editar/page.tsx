import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUserId } from '@/src/core/lib/auth'
import { getExpenseById } from '@/src/domains/expenses/data'
import { getEvents } from '@/src/domains/events/data'
import { updateExpense } from '@/src/domains/expenses/actions'
import { ExpenseForm } from '@/src/domains/expenses/components'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'

interface EditExpensePageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: EditExpensePageProps): Promise<Metadata> {
  const { id } = await params
  const userId = await getCurrentUserId()
  const expense = await getExpenseById(id, userId)
  if (!expense) return { title: 'Gasto no encontrado | RITUAL' }
  return { title: `Editar gasto — $${Number(expense.amount).toLocaleString('es-AR')} | RITUAL` }
}

export default async function EditExpensePage({ params }: EditExpensePageProps) {
  const { id } = await params
  const userId = await getCurrentUserId()
  const [expense, events] = await Promise.all([
    getExpenseById(id, userId),
    getEvents(),
  ])
  if (!userId || !expense) notFound()

  return (
    <PageShell
      backHref={routes.expenses.detail(id)}
      backLabel="← Volver al gasto"
      title="Editar gasto"
      description="Modificá monto, categoría, fecha o nota."
    >
      <ExpenseForm events={events} expense={expense} updateExpense={updateExpense} />
    </PageShell>
  )
}
