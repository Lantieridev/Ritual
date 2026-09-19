import { describe, it, expect, vi, beforeEach } from 'vitest'

const role = vi.fn()
vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ rpc: () => role() }),
}))
vi.mock('@/src/core/auth/session', () => ({ getCurrentUserId: vi.fn().mockResolvedValue('u1') }))

const service = {
  listMyNotifications: vi.fn(),
  countMyUnreadNotifications: vi.fn(),
  markMyNotificationsRead: vi.fn(),
  getMyNotificationPreferences: vi.fn(),
  updateMyNotificationPreference: vi.fn(),
}
vi.mock('@/src/domains/notifications/service', () => ({
  listMyNotifications: (...a: unknown[]) => service.listMyNotifications(...a),
  countMyUnreadNotifications: (...a: unknown[]) => service.countMyUnreadNotifications(...a),
  markMyNotificationsRead: (...a: unknown[]) => service.markMyNotificationsRead(...a),
  getMyNotificationPreferences: (...a: unknown[]) => service.getMyNotificationPreferences(...a),
  updateMyNotificationPreference: (...a: unknown[]) => service.updateMyNotificationPreference(...a),
}))

const sendAdminMessage = vi.fn()
vi.mock('@/src/domains/notifications/adminMessage', () => ({ sendAdminMessage: (...a: unknown[]) => sendAdminMessage(...a) }))

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

describe('notifications GraphQL schema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    role.mockResolvedValue({ data: 'usuario', error: null })
  })

  it('resolves myNotifications and the unread count', async () => {
    service.listMyNotifications.mockResolvedValue([
      { id: 'n1', type: 'admin_message', title: 'Hola', body: 'Cuerpo', readAt: null, createdAt: '2026-09-19T10:00:00Z' },
    ])
    service.countMyUnreadNotifications.mockResolvedValue(1)

    const body = await query('{ myNotifications(limit: 5) { id type title body readAt createdAt } unreadNotificationCount }')

    expect(body.errors).toBeUndefined()
    expect(service.listMyNotifications).toHaveBeenCalledWith(5)
    expect(body.data.unreadNotificationCount).toBe(1)
    expect(body.data.myNotifications[0]).toMatchObject({ id: 'n1', type: 'admin_message', readAt: null })
  })

  it('resolves the merged preference list', async () => {
    service.getMyNotificationPreferences.mockResolvedValue([
      { type: 'admin_message', label: 'Mensajes del equipo', description: 'd', inApp: true, email: false },
    ])

    const body = await query('{ notificationPreferences { type label inApp email } }')

    expect(body.data.notificationPreferences).toEqual([
      { type: 'admin_message', label: 'Mensajes del equipo', inApp: true, email: false },
    ])
  })

  it('marks notifications read and reports the result', async () => {
    service.markMyNotificationsRead.mockResolvedValue({})

    const body = await query('mutation { markNotificationsRead(ids: ["n1"]) { success error } }')

    expect(service.markMyNotificationsRead).toHaveBeenCalledWith(['n1'])
    expect(body.data.markNotificationsRead).toEqual({ success: true, error: null })
  })

  it('updates a preference', async () => {
    service.updateMyNotificationPreference.mockResolvedValue({})

    const body = await query(
      'mutation { updateNotificationPreference(type: post_show_reminder, inApp: true, email: false) { success } }'
    )

    expect(service.updateMyNotificationPreference).toHaveBeenCalledWith('post_show_reminder', { inApp: true, email: false })
    expect(body.data.updateNotificationPreference.success).toBe(true)
  })

  it('lets an admin send a message', async () => {
    role.mockResolvedValue({ data: 'admin', error: null })
    sendAdminMessage.mockResolvedValue({})

    const body = await query('mutation { sendAdminMessage(userId: "u2", title: "T", body: "B") { success } }')

    expect(sendAdminMessage).toHaveBeenCalledWith({ userId: 'u2', title: 'T', body: 'B' })
    expect(body.data.sendAdminMessage.success).toBe(true)
  })

  // Se asegura que el resolver rechace y que el caso de uso no se invoque, no
  // el código FORBIDDEN: bajo vitest yoga enmascara todo GraphQLError como
  // "Unexpected error." porque su `graphql` no es la misma instancia que la del
  // archivo fuente (mismo caso documentado en moderation.test.ts).
  it('forbids sendAdminMessage to moderators and regular users', async () => {
    for (const r of ['moderador', 'usuario']) {
      role.mockResolvedValue({ data: r, error: null })

      const body = await query('mutation { sendAdminMessage(userId: "u2", title: "T", body: "B") { success } }')

      expect(body.errors).toHaveLength(1)
    }
    expect(sendAdminMessage).not.toHaveBeenCalled()
  })
})
