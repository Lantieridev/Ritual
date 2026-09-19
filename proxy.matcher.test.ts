import { describe, it, expect, vi } from 'vitest'

// proxy.ts pulls in the Supabase session helper; only its matcher matters here.
vi.mock('@/src/core/lib/supabase/middleware', () => ({ updateSession: vi.fn() }))

import { config } from './proxy'

const matcher = new RegExp(`^${config.matcher[0]}$`)

describe('proxy matcher', () => {
  it.each(['/serwist/sw.js', '/serwist/sw.js.map', '/manifest.webmanifest', '/icons/icon-192.png'])(
    'skips %s',
    (path) => {
      expect(matcher.test(path)).toBe(false)
    }
  )

  it.each(['/', '/expenses/nuevo', '/api/graphql', '/~offline'])('still guards %s', (path) => {
    expect(matcher.test(path)).toBe(true)
  })
})
