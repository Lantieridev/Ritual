import { GraphQLError } from 'graphql'
import { builder } from './builder'
import { MutationResultRef, toMutationResult } from './shared'
import type { GraphQLContext } from './context'
import {
    listMyNotifications,
    countMyUnreadNotifications,
    markMyNotificationsRead,
    getMyNotificationPreferences,
    updateMyNotificationPreference,
    type NotificationItem,
    type NotificationPreferenceView,
} from '@/src/domains/notifications/service'
import { sendAdminMessage } from '@/src/domains/notifications/adminMessage'
import { NOTIFICATION_TYPES } from '@/src/domains/notifications/types'

/** GraphQLError (not Error) so yoga doesn't mask the denial as "Unexpected error." */
function requireAdmin(context: GraphQLContext) {
    if (context.role !== 'admin') {
        throw new GraphQLError('Unauthorized', { extensions: { code: 'FORBIDDEN' } })
    }
}

export const NotificationTypeEnum = builder.enumType('NotificationType', {
    values: NOTIFICATION_TYPES,
})

const NotificationRef = builder.objectRef<NotificationItem>('Notification')
NotificationRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        type: t.field({ type: NotificationTypeEnum, resolve: (n) => n.type }),
        title: t.exposeString('title'),
        body: t.exposeString('body'),
        readAt: t.exposeString('readAt', { nullable: true }),
        createdAt: t.exposeString('createdAt'),
    }),
})

const NotificationPreferenceRef = builder.objectRef<NotificationPreferenceView>('NotificationPreference')
NotificationPreferenceRef.implement({
    fields: (t) => ({
        type: t.field({ type: NotificationTypeEnum, resolve: (p) => p.type }),
        label: t.exposeString('label'),
        description: t.exposeString('description'),
        inApp: t.exposeBoolean('inApp'),
        email: t.exposeBoolean('email'),
    }),
})

builder.queryField('myNotifications', (t) =>
    t.field({
        type: [NotificationRef],
        description: 'Avisos del inbox del usuario actual, más nuevos primero.',
        args: { limit: t.arg.int() },
        resolve: async (_root, args) => listMyNotifications(args.limit ?? undefined),
    })
)

builder.queryField('unreadNotificationCount', (t) =>
    t.int({
        description: 'Cantidad de avisos sin leer del usuario actual (0 sin sesión).',
        resolve: () => countMyUnreadNotifications(),
    })
)

builder.queryField('notificationPreferences', (t) =>
    t.field({
        type: [NotificationPreferenceRef],
        description: 'Preferencia por tipo y canal, con los defaults aplicados.',
        resolve: () => getMyNotificationPreferences(),
    })
)

builder.mutationField('markNotificationsRead', (t) =>
    t.field({
        type: MutationResultRef,
        description: 'Marca como leídos los avisos indicados, o todos si no se pasan ids.',
        args: { ids: t.arg.idList() },
        resolve: async (_root, args) =>
            toMutationResult(await markMyNotificationsRead(args.ids ? args.ids.map(String) : undefined)),
    })
)

builder.mutationField('updateNotificationPreference', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            type: t.arg({ type: NotificationTypeEnum, required: true }),
            inApp: t.arg.boolean({ required: true }),
            email: t.arg.boolean({ required: true }),
        },
        resolve: async (_root, args) =>
            toMutationResult(await updateMyNotificationPreference(args.type, { inApp: args.inApp, email: args.email })),
    })
)

builder.mutationField('sendAdminMessage', (t) =>
    t.field({
        type: MutationResultRef,
        description: 'Mensaje directo de un administrador a un usuario (inbox + email).',
        args: {
            userId: t.arg.id({ required: true }),
            title: t.arg.string({ required: true }),
            body: t.arg.string({ required: true }),
        },
        resolve: async (_root, args, context) => {
            requireAdmin(context)
            return toMutationResult(
                await sendAdminMessage({ userId: String(args.userId), title: args.title, body: args.body })
            )
        },
    })
)
