import Link from 'next/link'
import { routes } from '@/src/core/lib/routes'

export interface NearbyNoticeProps {
  status: 'no-session' | 'no-city'
}

/** Copy exacto de design.md — nunca inventa una distancia, dice explícitamente qué falta (Requirement "Cerca honest degradation"). */
const COPY = {
  'no-session': {
    kicker: '«Cerca» necesita tu sesión',
    body: 'Ordena sedes por distancia real desde tu ciudad. Entrá y guardá tu ciudad en el perfil.',
    linkLabel: 'Entrar',
    href: routes.login,
  },
  'no-city': {
    kicker: 'No sabemos desde dónde medir',
    body: 'Guardá tu ciudad en el perfil y «Cerca» ordena las sedes por distancia real.',
    linkLabel: 'Ir al perfil',
    href: routes.profile,
  },
} as const

export function NearbyNotice({ status }: NearbyNoticeProps) {
  const copy = COPY[status]
  return (
    <div role="status" className="px-5 py-8 text-center">
      <p className="font-label text-[9px] tracking-[0.14em] uppercase text-ritual-gray-mid-2">{copy.kicker}</p>
      <p className="font-body text-sm text-ritual-gray-text mt-2">{copy.body}</p>
      <Link
        href={copy.href}
        className="inline-flex min-h-[44px] items-center font-label text-[10px] tracking-[0.16em] uppercase text-ritual-red mt-4"
      >
        {copy.linkLabel}
      </Link>
    </div>
  )
}
