import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUserId } from '@/src/core/auth/session'
import { listExpenses, summarizeExpenses } from '@/src/domains/expenses/service'
import { routes } from '@/src/core/lib/routes'
import { formatDate } from '@/src/core/lib/utils'
import { getExpenseCategory } from '@/src/domains/expenses/categories'
import { LinkButton } from '@/src/core/components/ui'
import { PageShell } from '@/src/core/components/layout'

export const metadata: Metadata = {
  title: 'Gastos | RITUAL',
  description: 'Gastos personales de recitales. No se comparten con otros usuarios.',
}

function formatARS(amount: number) {
  return `$${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

export default async function ExpensesPage() {
  const userId = await getCurrentUserId()
  const [expenses, summary] = await Promise.all([
    listExpenses(userId),
    summarizeExpenses(userId),
  ])

  const topCategories = Object.entries(summary.byCategory).sort(([, a], [, b]) => b - a)
  const mostExpensive = expenses.length > 0 ? expenses.reduce((max, e) => (Number(e.amount) > Number(max.amount) ? e : max)) : null

  return (
    <PageShell
      backHref={routes.home}
      backLabel="← Inicio"
      title="Gastos"
      action={userId ? <LinkButton href={routes.expenses.new} variant="primary" className="px-4 py-2">+ Nuevo gasto</LinkButton> : undefined}
    >
      {!userId && (
        <p className="font-body text-sm bg-ritual-surface border border-ritual-border-subtle px-4 py-3 mb-6 text-ritual-gray-text">
          Iniciá sesión para ver y cargar gastos.
        </p>
      )}

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="font-body text-ritual-gray-text max-w-sm">
            {userId ? 'No tenés gastos cargados todavía.' : 'No hay gastos para mostrar.'}
          </p>
          {userId && (
            <LinkButton href={routes.expenses.new} variant="primary" className="px-6 py-2.5 mt-2">
              + Nuevo gasto
            </LinkButton>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {/* Total como titular */}
          <div>
            <p className="font-display leading-[0.8] text-ritual-bone" style={{ fontSize: 'min(20vw, 140px)' }}>
              {formatARS(summary.total)}
            </p>
            <p className="font-label text-xs tracking-[0.1em] uppercase text-ritual-gray-text mt-2">
              {summary.count} gasto{summary.count !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Barra de categorías */}
          {topCategories.length > 0 && (
            <section>
              <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">Por categoría</h2>
              <div className="space-y-2">
                {topCategories.map(([cat, amount]) => {
                  const pct = summary.total > 0 ? (amount / summary.total) * 100 : 0
                  const { icon } = getExpenseCategory(cat)
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="font-label text-xs text-ritual-gray-text min-w-[120px]">
                        {icon} {cat}
                      </span>
                      <div className="flex-1 h-1.5 bg-ritual-surface overflow-hidden">
                        <div className="h-full bg-ritual-red" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-label text-sm text-ritual-gray-light-3 tabular-nums min-w-[80px] text-right">
                        {formatARS(amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* La noche más cara — ticket de papel */}
          {mostExpensive && (
            <section>
              <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">La noche más cara</h2>
              <div className="bg-ritual-paper text-ritual-paper-ink border-l-[3px] border-ritual-paper-red px-6 py-6 max-w-sm">
                <p className="font-label text-[9px] tracking-[0.14em] uppercase opacity-60">
                  {getExpenseCategory(mostExpensive.category).icon} {mostExpensive.category} · {formatDate(mostExpensive.date, { day: 'numeric', month: 'short' })}
                </p>
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-dashed border-ritual-paper-2 font-figure text-3xl">
                  <span>TOTAL</span>
                  <span>{formatARS(Number(mostExpensive.amount))}</span>
                </div>
                <p className="font-label text-[9px] tracking-[0.1em] uppercase opacity-50 mt-3">no se aceptan devoluciones</p>
              </div>
            </section>
          )}

          {/* Movimientos */}
          <section>
            <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">Todos los gastos</h2>
            <ul className="divide-y divide-ritual-border-subtle">
              {expenses.map((ex) => {
                const { icon } = getExpenseCategory(ex.category)
                return (
                  <li key={ex.id}>
                    <Link href={routes.expenses.detail(ex.id)} className="flex items-center justify-between gap-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-dense font-extrabold text-ritual-bone">
                          {icon} {formatARS(Number(ex.amount))}
                        </p>
                        {ex.note && <p className="font-label text-xs text-ritual-gray-text mt-0.5 truncate">{ex.note}</p>}
                      </div>
                      <p className="font-label text-xs text-ritual-gray-text whitespace-nowrap">{formatDate(ex.date, { day: 'numeric', month: 'short' })}</p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      )}
    </PageShell>
  )
}
