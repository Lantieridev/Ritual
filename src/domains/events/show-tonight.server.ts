import 'server-only'
import { cookies } from 'next/headers'
import { findShowTonight } from './service'
import { bandaLinkFor } from './show-tonight'
import { isDevBandaAllowed, DEV_BANDA_COOKIE } from './dev-banda'
import { routes } from '@/src/core/lib/routes'
import type { MobileBandaLink } from '@/src/core/components/layout/MobileAction'

/**
 * Fixture fija que la suite de e2e puede forzar con el cookie de dev
 * (R1-001) — no depende de datos reales, así `banda.spec.ts` no necesita una
 * sesión ni un show cargado en la base.
 */
const DEV_BANDA_LINK: MobileBandaLink = {
  subtitle: 'Tu entrada de hoy',
  title: 'Show de prueba · 21:00',
  actionLabel: 'Abrir',
  href: routes.tonightTicket,
}

/**
 * Resuelve la banda de "Tu entrada de hoy" para el layout raíz (issue #82).
 * Nunca rechaza (R1-002): el layout raíz envuelve TODAS las rutas, así que
 * cualquier falla acá degrada a `undefined` (sin banda) en vez de romper la
 * app entera. Reusa el `userId` que el layout ya resolvió — nunca vuelve a
 * llamar a `auth.getUser()`.
 */
export async function loadBandaAction(userId: string | null): Promise<MobileBandaLink | undefined> {
  try {
    const cookieStore = await cookies()
    const devAllowed = isDevBandaAllowed({
      nodeEnv: process.env.NODE_ENV,
      token: process.env.RITUAL_E2E_BANDA_TOKEN,
      cookie: cookieStore.get(DEV_BANDA_COOKIE)?.value,
    })
    if (devAllowed) return DEV_BANDA_LINK

    if (!userId) return undefined

    const show = await findShowTonight(userId)
    if (!show) return undefined

    return bandaLinkFor(show)
  } catch (e) {
    console.error('Error cargando la banda de entrada:', e)
    return undefined
  }
}
