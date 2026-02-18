import type { Metadata } from 'next'
import { getEvents } from '@/src/domains/events/data'
import { ExpenseForm } from '@/src/domains/expenses/components'
import { createExpense } from '@/src/domains/expenses/actions'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'

export const metadata: Metadata = {
  title: 'Nuevo gasto | RITUAL',
  description: 'Registrá un gasto (entrada, viaje, etc.). Podés asociarlo a un recital.',
}

/**
 * Página para agregar un gasto personal.
 * Carga eventos para opcionalmente asociar el gasto a un recital.
 */
export default async function NewExpensePage() {
  const events = await getEvents()

  return (
    <PageShell
      backHref={routes.expenses.list}
      backLabel="← Volver a gastos"
      title="Nuevo gasto"
      description="Registrá un gasto (entrada, viaje, etc.). Podés asociarlo a un recital."
    >
      <ExpenseForm events={events} createExpense={createExpense} />
    </PageShell>
  )
}
