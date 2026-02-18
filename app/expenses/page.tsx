import Link from 'next/link'
import type { Metadata } from 'next'
import { getCurrentUserId } from '@/src/core/lib/auth'
import { getExpenses } from '@/src/domains/expenses/data'
import { routes } from '@/src/core/lib/routes'
import { Card, LinkButton } from '@/src/core/components/ui'
import { PageShell } from '@/src/core/components/layout'

export const metadata: Metadata = {
  title: 'Mis gastos | RITUAL',
  description: 'Gastos personales de recitales (entrada, viaje, etc.). No se comparten con otros usuarios.',
}

/**
 * Listado de gastos del usuario. Solo ve los suyos (RLS).
 * Sin sesión o sin RITUAL_DEV_USER_ID: lista vacía y mensaje.
 */
export default async function ExpensesPage() {
  const userId = await getCurrentUserId()
  const expenses = await getExpenses(userId)

  return (
    <PageShell
      backHref={routes.home}
      backLabel="← Inicio"
      title="Mis gastos"
      description="Gastos personales de recitales (entrada, viaje, etc.). No se comparten con otros usuarios."
      action={
        <LinkButton href={routes.expenses.new} variant="primary" className="px-4 py-2 text-sm">
          + Nuevo gasto
        </LinkButton>
      }
    >
      {!userId && (
        <p className="rounded-lg bg-zinc-500/10 border border-zinc-500/30 text-zinc-300 px-4 py-3 text-sm mb-6">
          Iniciá sesión para ver y cargar gastos. En desarrollo podés setear <code className="bg-white/10 px-1 rounded">RITUAL_DEV_USER_ID</code> en .env.local con tu user id de Supabase Auth.
        </p>
      )}

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-zinc-500 max-w-sm">
            {userId ? 'No tenés gastos cargados todavía.' : 'No hay gastos para mostrar.'}
          </p>
          {userId && (
            <LinkButton href={routes.expenses.new} variant="primary" className="px-6 py-2.5">
              + Nuevo gasto
            </LinkButton>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 mb-6 inline-block">
            <p className="text-sm text-zinc-400 uppercase tracking-wider">Total</p>
            <p className="text-2xl font-bold text-white">
              ${expenses.reduce((sum, ex) => sum + Number(ex.amount), 0).toLocaleString('es-AR')}
            </p>
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {expenses.map((ex) => (
              <li key={ex.id}>
                <Link href={routes.expenses.detail(ex.id)} className="block h-full">
                  <Card className="h-full hover:border-white/20">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-white">
                          ${Number(ex.amount).toLocaleString('es-AR')}
                        </p>
                        <p className="text-sm text-zinc-400">{ex.category}</p>
                        {ex.note && <p className="text-sm text-zinc-500 mt-0.5 line-clamp-1">{ex.note}</p>}
                      </div>
                      <p className="text-sm text-zinc-500">
                        {new Date(ex.date).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageShell>
  )
}
