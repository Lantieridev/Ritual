import { builder } from './builder'
import { MutationResultRef, toMutationResult } from './shared'
import { getGoogleCalendarStatus, connectGoogleCalendar, disconnectGoogleCalendar, syncEventToGoogleCalendar } from '@/src/domains/google-calendar/service'

builder.queryField('googleCalendarStatus', (t) =>
    t.field({
        type: 'Boolean',
        description: 'True si el usuario tiene conectado Google Calendar.',
        resolve: async () => getGoogleCalendarStatus(),
    })
)

builder.mutationField('connectGoogleCalendar', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            code: t.arg.string({ required: true }),
            redirectUri: t.arg.string({ required: true }),
        },
        resolve: async (_root, args) =>
            toMutationResult(
                await connectGoogleCalendar(args.code, args.redirectUri)
            ),
    })
)

builder.mutationField('disconnectGoogleCalendar', (t) =>
    t.field({
        type: MutationResultRef,
        resolve: async () =>
            toMutationResult(
                await disconnectGoogleCalendar()
            ),
    })
)

builder.mutationField('syncEventToGoogleCalendar', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            eventId: t.arg.id({ required: true }),
        },
        resolve: async (_root, args) =>
            toMutationResult(
                await syncEventToGoogleCalendar(String(args.eventId))
            ),
    })
)
