import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getEventById } from '@/src/domains/events/data'

import { getCurrentUserId } from '@/src/core/auth/session'
import { routes } from '@/src/core/lib/routes'
import { formatDate } from '@/src/core/lib/utils'
import { getExpenseCategory } from '@/src/domains/expenses/categories'
import { groupExpensesByCategory } from '@/src/domains/expenses/grouping'
import { formatChoripanComparison, adjustForInflation } from '@/src/domains/expenses/comparisons'
import { PageShell } from '@/src/core/components/layout'

interface EventExpensesPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: EventExpensesPageProps): Promise<Metadata> {
  const { id } = await params
  const event = await getEventById(id)
  if (!event) return { title: 'Recital no encontrado | RITUAL' }
  const title = event.name || event.lineups?.[0]?.artists?.name || 'Recital'
  return { title: `Gastos — ${title} | RITUAL` }
}

function formatARS(amount: number) {
  return `$${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

/**
 * Issue #7's "vista de detalle completa con el desglose por categoría" —
 * linked from the event page's inline expense summary. Read-only: editing
 * stays inline on the event page itself ("nunca redirige a /expenses", and
 * this view isn't /expenses either — it's this specific show's own page).
 */
import { getClient } from '@/src/graphql/client'
import { gql } from 'urql'

const EventExpensesPageQuery = gql`
  query EventExpensesPage($eventId: ID!) {
    expenses(eventId: $eventId) {
      id amount category note date
    }
    estimateSpendForEvent(eventId: $eventId) {
      averageTotal
      eventsConsidered
    }
  }
`

export default async function EventExpensesPage({ params }: EventExpensesPageProps) {
  const { id } = await params
  const userId = await getCurrentUserId()
  const event = await getEventById(id)
  if (!event) notFound()

  const { data } = await getClient().query<{ expenses: import('@/src/core/types').GraphQLExpense[], estimateSpendForEvent: { averageTotal: number, eventsConsidered: number } | null }>(EventExpensesPageQuery, { eventId: id }).toPromise()
  const expenses = data?.expenses ?? []
  const spendEstimate = data?.estimateSpendForEvent ?? null

  const total = expenses.reduce((sum: number, e: import('@/src/core/types').GraphQLExpense) => sum + Number(e.amount), 0)
  const groups = groupExpensesByCategory(expenses)
  const choripanLine = formatChoripanComparison(total)
  const mainArtist = event.lineups?.[0]?.artists
  const eventTitle = event.name || mainArtist?.name || 'Recital'

  return (
    <PageShell
      backHref={routes.events.detail(id)}
      backLabel="← Volver al recital"
      title="Gastos"
      description={`${eventTitle} · ${formatDate(event.date)}`}
    >
      {!userId ? (
        <p className="font-body text-sm bg-ritual-surface border border-ritual-border-subtle px-4 py-3 text-ritual-gray-text">
          Iniciá sesión para ver los gastos de este recital.
        </p>
      ) : expenses.length === 0 ? (
        <p className="font-body text-sm text-ritual-gray-text">
          Todavía no cargaste gastos para este show. Volvé al recital para agregar el primero.
        </p>
      ) : (
        <div className="space-y-10">
          <div>
            <p className="font-display leading-[0.8] text-ritual-bone" style={{ fontSize: 'min(18vw, 120px)' }}>
              {formatARS(total)}
            </p>
            <p className="font-label text-xs tracking-[0.1em] uppercase text-ritual-gray-text mt-2">
              {expenses.length} ítem{expenses.length !== 1 ? 's' : ''}
              {choripanLine ? ` · ${choripanLine}` : ''}
            </p>
          </div>

          {spendEstimate && (
            <p className="font-body text-sm text-ritual-gray-text italic">
              Sueles gastar un promedio de {formatARS(spendEstimate.averageTotal)} en shows similares (misma sede o
              artista, {spendEstimate.eventsConsidered} show{spendEstimate.eventsConsidered !== 1 ? 's' : ''}{' '}
              anteriores) — solo de referencia, no un límite.
            </p>
          )}

          <div className="space-y-8">
            {groups.map((group) => {
              const { icon } = getExpenseCategory(group.category)
              const groupChoripanLine = formatChoripanComparison(group.total)
              return (
                <section key={group.category} className="border-t border-ritual-border-subtle pt-6">
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <h2 className="font-subtitle font-black text-xl uppercase text-ritual-bone">
                      {icon} {group.category}
                    </h2>
                    <p className="font-figure text-xl text-ritual-bone">{formatARS(group.total)}</p>
                  </div>
                  {groupChoripanLine && (
                    <p className="font-label text-xs text-ritual-gray-text mb-4">{groupChoripanLine}</p>
                  )}
                  <ul className="divide-y divide-ritual-border-subtle">
                    {group.expenses.map((expense) => {
                      const inflation = adjustForInflation(Number(expense.amount), expense.date)
                      return (
                        <li key={expense.id} className="py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-body text-sm text-ritual-bone">{formatARS(Number(expense.amount))}</p>
                              {expense.note && (
                                <p className="font-label text-xs text-ritual-gray-text mt-0.5">{expense.note}</p>
                              )}
                            </div>
                            <p className="font-label text-xs text-ritual-gray-text whitespace-nowrap">
                              {formatDate(expense.date, { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          {inflation && (
                            <p className="font-label text-[11px] text-ritual-gray-text mt-1 italic">
                              En poder de compra de hoy: ~{formatARS(inflation.adjustedAmount)} (inflación acumulada
                              INDEC {inflation.fromYear}→{inflation.toYear})
                            </p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>

          <div className="pt-2">
            <Link
              href={routes.events.detail(id)}
              className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text hover:text-ritual-bone transition-colors underline underline-offset-4"
            >
              ← Volver al recital
            </Link>
          </div>
        </div>
      )}
    </PageShell>
  )
}
