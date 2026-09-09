import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Cookie que la suite de e2e usa para forzar la banda de "Tu entrada de hoy"
 * sin necesitar una sesión real ni un show cargado en la base (issue #82).
 */
export const DEV_BANDA_COOKIE = 'ritual-dev-banda'

interface DevBandaInput {
  nodeEnv: string | undefined
  /** `RITUAL_E2E_BANDA_TOKEN` — server-only, nunca `NEXT_PUBLIC_`, nunca seteado en producción. */
  token: string | undefined
  cookie: string | undefined
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

/**
 * Gate del cookie de e2e (R1-001): un deploy mal configurado no puede filtrar
 * la banda con sólo `NODE_ENV !== 'production'` — hace falta ADEMÁS un
 * secreto server-only no vacío, y el cookie tiene que igualarlo. La
 * comparación es contra digests SHA-256 (longitud fija, `timingSafeEqual`)
 * en vez del valor crudo: evita tanto una comparación no constante en tiempo
 * como una fuga de longitud si el token y el cookie difieren en tamaño.
 */
export function isDevBandaAllowed({ nodeEnv, token, cookie }: DevBandaInput): boolean {
  if (nodeEnv === 'production') return false
  if (!token) return false
  if (!cookie) return false
  return timingSafeEqual(sha256(cookie), sha256(token))
}
