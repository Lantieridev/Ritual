import { describe, it, expect } from 'vitest'
import { ventiAdapter } from './venti'

// venti.com.ar migró a venti.live (SPA client-side, sin API ni HTML
// scrapeable desde el servidor) -confirmado en vivo, ver el comentario en
// venti.ts. El adapter queda registrado pero reporta el error real en vez
// de pegarle a una URL muerta todos los días.
describe('Venti Adapter', () => {
  it('reports the known-broken state instead of calling the dead API', async () => {
    const result = await ventiAdapter.search({ keyword: 'Venti' })

    expect(result.events).toHaveLength(0)
    expect(result.error).toContain('venti.live')
  })
})
