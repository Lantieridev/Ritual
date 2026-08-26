import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/moderation/service', () => ({
  getUnverifiedArtists: vi.fn(),
  getUnverifiedVenues: vi.fn(),
  getUnverifiedEvents: vi.fn(),
  searchMergeTargets: vi.fn(),
  approveArtist: vi.fn(),
  approveVenue: vi.fn(),
  approveEvent: vi.fn(),
  mergeArtists: vi.fn(),
  mergeVenues: vi.fn(),
  mergeEvents: vi.fn(),
}))

const mocks = vi.hoisted(() => ({
  rpc: vi.fn().mockResolvedValue({ data: 'usuario', error: null }),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ rpc: mocks.rpc }),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue('u-1'),
}))

import {
  getUnverifiedArtists,
  searchMergeTargets,
  approveArtist,
  mergeArtists,
} from '@/src/domains/moderation/service'
import { getCurrentUserId } from '@/src/core/auth/session'
import { POST } from '@/app/api/graphql/route'

async function query(source: string) {
  const response = await POST(
    new Request('http://localhost/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: source }),
    })
  )
  return response.json()
}

function actAs(role: 'admin' | 'moderador' | 'usuario') {
  mocks.rpc.mockResolvedValue({ data: role, error: null })
}

describe('moderation GraphQL schema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('u-1')
    actAs('usuario')
  })

  // Las aserciones miran que el resolver corte y que la capa de servicio nunca
  // se invoque, no el texto del mensaje: yoga sólo deja pasar sin enmascarar
  // los GraphQLError que reconoce con `instanceof`, y bajo vitest el `graphql`
  // que resuelve el archivo fuente no es la misma instancia de módulo que la
  // que importa yoga desde node_modules, así que acá el mensaje siempre llega
  // como "Unexpected error." aunque en un build real de Next.js no lo haga.
  // Mismo enmascarado que ya documenta expenses.test.ts.
  describe('role guard', () => {
    it('rejects a plain usuario', async () => {
      const body = await query('{ unverifiedArtists { id } }')

      expect(body.errors).toHaveLength(1)
      expect(getUnverifiedArtists).not.toHaveBeenCalled()
    })

    it('rejects an anonymous caller', async () => {
      vi.mocked(getCurrentUserId).mockResolvedValue(null)

      const body = await query('{ unverifiedArtists { id } }')

      expect(body.errors).toHaveLength(1)
      expect(getUnverifiedArtists).not.toHaveBeenCalled()
    })

    it.each(['admin', 'moderador'] as const)('lets %s through', async (role) => {
      actAs(role)
      vi.mocked(getUnverifiedArtists).mockResolvedValue([])

      const body = await query('{ unverifiedArtists { id } }')

      expect(body.errors).toBeUndefined()
      expect(getUnverifiedArtists).toHaveBeenCalled()
    })

    it('guards mergeTargets too, not just the queue', async () => {
      const body = await query('{ mergeTargets(entityType: artists, query: "x") { id } }')

      expect(body.errors).toHaveLength(1)
      expect(searchMergeTargets).not.toHaveBeenCalled()
    })

    it('guards the mutations', async () => {
      const body = await query('mutation { approveArtist(id: "a-1") { success } }')

      expect(body.errors).toHaveLength(1)
      expect(approveArtist).not.toHaveBeenCalled()
    })
  })

  describe('mergeTargets', () => {
    beforeEach(() => {
      actAs('moderador')
    })

    it('forwards the entity type, term and exclusion to the service', async () => {
      vi.mocked(searchMergeTargets).mockResolvedValue([])

      await query('{ mergeTargets(entityType: venues, query: "river", excludeId: "v-9") { id } }')

      expect(searchMergeTargets).toHaveBeenCalledWith('venues', 'river', 'v-9')
    })

    it('passes undefined when no exclusion is given', async () => {
      vi.mocked(searchMergeTargets).mockResolvedValue([])

      await query('{ mergeTargets(entityType: artists, query: "radio") { id } }')

      expect(searchMergeTargets).toHaveBeenCalledWith('artists', 'radio', undefined)
    })

    it('exposes id, name and detail', async () => {
      vi.mocked(searchMergeTargets).mockResolvedValue([
        { id: 'a-1', name: 'Radiohead', detail: 'rock' },
      ])

      const body = await query('{ mergeTargets(entityType: artists, query: "radio") { id name detail } }')

      expect(body.errors).toBeUndefined()
      expect(body.data).toEqual({
        mergeTargets: [{ id: 'a-1', name: 'Radiohead', detail: 'rock' }],
      })
    })
  })

  describe('mutation results', () => {
    beforeEach(() => {
      actAs('moderador')
    })

    it('reports success when the approval goes through', async () => {
      vi.mocked(approveArtist).mockResolvedValue(undefined)

      const body = await query('mutation { approveArtist(id: "a-1") { success error } }')

      expect(body.data).toEqual({ approveArtist: { success: true, error: null } })
    })

    it('reports failure with the message when the RPC rejects the caller', async () => {
      vi.mocked(approveArtist).mockRejectedValue(new Error('insufficient_privilege'))

      const body = await query('mutation { approveArtist(id: "a-1") { success error } }')

      expect(body.data).toEqual({
        approveArtist: { success: false, error: 'insufficient_privilege' },
      })
    })

    it('reports failure when a merge rejects', async () => {
      vi.mocked(mergeArtists).mockRejectedValue(new Error('insufficient_privilege'))

      const body = await query(
        'mutation { mergeArtists(sourceId: "a-1", targetId: "a-2") { success error } }'
      )

      expect(body.data).toEqual({
        mergeArtists: { success: false, error: 'insufficient_privilege' },
      })
    })
  })
})
