import { describe, it, expect } from 'vitest'
import { isDevBandaAllowed, DEV_BANDA_COOKIE } from '@/src/domains/events/dev-banda'

/**
 * Gate del cookie de e2e para la banda de "Tu entrada de hoy" (R1-001):
 * sólo en no-producción, con un secreto server-only configurado, comparado
 * en tiempo constante contra digests SHA-256 de igual longitud (sin fuga
 * por longitud del valor crudo).
 */
describe('isDevBandaAllowed', () => {
  it('nombra el cookie exacto que consume el layout', () => {
    expect(DEV_BANDA_COOKIE).toBe('ritual-dev-banda')
  })

  it('sin token configurado, nunca habilita — aunque el cookie matchee "undefined"', () => {
    expect(isDevBandaAllowed({ nodeEnv: 'development', token: undefined, cookie: 'undefined' })).toBe(false)
  })

  it('token vacío nunca habilita', () => {
    expect(isDevBandaAllowed({ nodeEnv: 'development', token: '', cookie: '' })).toBe(false)
  })

  it('cookie que no matchea el token no habilita', () => {
    expect(isDevBandaAllowed({ nodeEnv: 'development', token: 'secreto-e2e', cookie: 'otro-valor' })).toBe(false)
  })

  it('cookie de distinta longitud que el token no habilita', () => {
    expect(isDevBandaAllowed({ nodeEnv: 'development', token: 'secreto-e2e', cookie: 'corto' })).toBe(false)
  })

  it('en producción no habilita aunque el cookie matchee el token', () => {
    expect(isDevBandaAllowed({ nodeEnv: 'production', token: 'secreto-e2e', cookie: 'secreto-e2e' })).toBe(false)
  })

  it('fuera de producción con el cookie exacto habilita', () => {
    expect(isDevBandaAllowed({ nodeEnv: 'development', token: 'secreto-e2e', cookie: 'secreto-e2e' })).toBe(true)
    expect(isDevBandaAllowed({ nodeEnv: 'test', token: 'secreto-e2e', cookie: 'secreto-e2e' })).toBe(true)
  })

  it('sin cookie no habilita, incluso con token configurado', () => {
    expect(isDevBandaAllowed({ nodeEnv: 'development', token: 'secreto-e2e', cookie: undefined })).toBe(false)
  })
})
