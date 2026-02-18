import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUserId } from '@/src/core/lib/auth'
import { getExpenses, getExpensesSummary } from '@/src/domains/expenses/data'
import { routes } from '@/src/core/lib/routes'
import { Card, LinkButton } from '@/src/core/components/ui'
import { PageShell } from '@/src/core/components/layout'

export const metadata: Metadata = {
  title: 'Mis gastos | RITUAL',
  description: 'Gastos personales de recitales. No se comparten con otros usuarios.',
}

const CATEGORY_ICONS: Record<string, string> = {
  Entrada: '🎟️',
  Transporte: '🚌',
  Merch: '👕',
  Comida: '🍔',
  Alojamiento: '🏨',
  Otro: '💸',
}

const CATEGORY_COLORS: Record<string, string> = {
  Entrada: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  Transporte: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Merch: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  Comida: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Alojamiento: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  Otro: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
}

function formatARS(amount: number) {
  return `$${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

export default async function ExpensesPage() {
  const userId = await getCurrentUserId()
  const [expenses, summary] = await Promise.all([
    getExpenses(userId),
    getExpensesSummary(userId),
  ])

  const years = Object.keys(summary.byYear).sort((a, b) => Number(b) - Number(a))
  const topCategories = Object.entries(summary.byCategory)
    .sort(([, a], [, b]) => b - a)

  return (
    <PageShell
      backHref={routes.home}
      backLabel="← Inicio"
      title="Mis gastos"
      description="Gastos personales de recitales."
      action={
        userId ? (
          <LinkButton href={routes.expenses.new} variant="primary" className="px-4 py-2 text-sm">
            + Nuevo gasto
          </LinkButton>
        ) : undefined
      }
    >
      {!userId && (
        <p className="rounded-lg bg-zinc-500/10 border border-zinc-500/30 text-zinc-300 px-4 py-3 text-sm mb-6">
          Iniciá sesión para ver y cargar gastos. En desarrollo podés setear{' '}
          <code className="bg-white/10 px-1 rounded">RITUAL_DEV_USER_ID</code> en .env.local.
        </p>
      )}

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-5xl">💸</p>
          <p className="text-zinc-500 max-w-sm">
            {userId ? 'No tenés gastos cargados todavía.' : 'No hay gastos para mostrar.'}
          </p>
          {userId && (
            <LinkButton href={routes.expenses.new} variant="primary" className="px-6 py-2.5 mt-2">
              + Nuevo gasto
            </LinkButton>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Total</p>
              <p className="text-2xl font-bold text-white">{formatARS(summary.total)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Gastos</p>
              <p className="text-2xl font-bold text-white">{summary.count}</p>
            </div>
            {years[0] && (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 col-span-2 sm:col-span-1">
                <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">{years[0]}</p>
                <p className="text-2xl font-bold text-white">{formatARS(summary.byYear[years[0]])}</p>
              </div>
            )}
          </div>

          {/* Breakdown por categoría */}
          {topCategories.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Por categoría</p>
              <div className="space-y-2">
                {topCategories.map(([cat, amount]) => {
                  const pct = summary.total > 0 ? (amount / summary.total) * 100 : 0
                  const icon = CATEGORY_ICONS[cat] ?? '💸'
                  const colorClass = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['Otro']
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${colorClass} min-w-[110px]`}>
                        {icon} {cat}
                      </span>
                      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white/40 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-zinc-300 tabular-nums min-w-[80px] text-right">
                        {formatARS(amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Lista de gastos */}
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Todos los gastos</p>
            <ul className="grid gap-3 md:grid-cols-2">
              {expenses.map((ex) => {
                const icon = CATEGORY_ICONS[ex.category] ?? '💸'
                const colorClass = CATEGORY_COLORS[ex.category] ?? CATEGORY_COLORS['Otro']
                return (
                  <li key={ex.id}>
                    <Link href={routes.expenses.detail(ex.id)} className="block h-full">
                      <Card className="h-full hover:border-white/20 transition-colors">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${colorClass}`}>
                                {icon} {ex.category}
                              </span>
                            </div>
                            <p className="text-lg font-bold text-white">{formatARS(Number(ex.amount))}</p>
                            {ex.note && (
                              <p className="text-sm text-zinc-500 mt-0.5 line-clamp-1">{ex.note}</p>
                            )}
                          </div>
                          <p className="text-sm text-zinc-600 whitespace-nowrap">
                            {new Date(ex.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                      </Card>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </PageShell>
  )
}
