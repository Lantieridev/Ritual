import type { Metadata } from 'next'
import Link from 'next/link'
import { getVenues } from '@/src/domains/venues/data'
import { routes } from '@/src/core/lib/routes'
import { LinkButton } from '@/src/core/components/ui'
import { PageShell } from '@/src/core/components/layout'

export const metadata: Metadata = {
  title: 'Sedes | RITUAL',
  description: 'Sedes y venues para tus recitales.',
}

export default async function VenuesPage() {
  const venues = await getVenues()

  return (
    <PageShell
      title="Sedes"
      action={
        <LinkButton href={routes.venues.new} variant="primary" className="px-4 py-2 text-sm">
          + Nueva sede
        </LinkButton>
      }
    >
      {venues.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-zinc-300 mb-1">No hay sedes cargadas</p>
            <p className="text-sm text-zinc-600">Agregá una sede para poder crear recitales.</p>
          </div>
          <LinkButton href={routes.venues.new} variant="primary" className="px-6 py-2.5 text-sm">
            + Nueva sede
          </LinkButton>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {venues.map((v) => (
            <li key={v.id}>
              <Link
                href={routes.venues.detail(v.id)}
                className="group flex flex-col gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 hover:border-white/20 hover:bg-white/[0.06] transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-white group-hover:text-zinc-100 transition-colors">{v.name}</p>
                  <span className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0 mt-0.5">→</span>
                </div>
                {(v.city || v.country) && (
                  <p className="text-sm text-zinc-500">
                    {[v.city, v.country].filter(Boolean).join(', ')}
                  </p>
                )}
                {v.address && (
                  <p className="text-xs text-zinc-600 mt-0.5">{v.address}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  )
}
