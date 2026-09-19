export const NOTIFICATION_TYPES = ['moderation_rejected', 'post_show_reminder', 'admin_message'] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export interface ChannelPreference {
    inApp: boolean
    email: boolean
}

/** Applies when the user never touched the setting: every channel on. */
export const DEFAULT_CHANNELS: ChannelPreference = { inApp: true, email: true }

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, { label: string; description: string }> = {
    moderation_rejected: {
        label: 'Entrada rechazada',
        description: 'Cuando un moderador rechaza algo que subiste, con el motivo.',
    },
    post_show_reminder: {
        label: 'Recordatorio post-show',
        description: 'Un solo aviso con todo lo que falta cargar de un show.',
    },
    admin_message: {
        label: 'Mensajes del equipo',
        description: 'Avisos directos de un administrador sobre tu cuenta.',
    },
}

export function isNotificationType(value: string): value is NotificationType {
    return (NOTIFICATION_TYPES as readonly string[]).includes(value)
}

export function resolveChannels(row: { in_app: boolean; email: boolean } | null | undefined): ChannelPreference {
    if (!row) return DEFAULT_CHANNELS
    return { inApp: row.in_app, email: row.email }
}
