import { builder } from './builder'
import { listVenues, findVenueById, insertVenue, findOrCreateVenue, addVenueTip, removeVenueTip } from '@/src/domains/venues/service'
import type { VenueEvent, VenueWithEvents, VenueTip, VenueTipCategory } from '@/src/domains/venues/service'
import type { Venue } from '@/src/core/types'
import { MutationResultRef, toMutationResult } from './shared'

const VenueEventLineupArtistRef = builder.objectRef<VenueEvent['lineups'][number]['artists']>(
    'VenueEventLineupArtist'
)
VenueEventLineupArtistRef.implement({
    fields: (t) => ({
        name: t.exposeString('name'),
    }),
})

const VenueEventLineupRef = builder.objectRef<VenueEvent['lineups'][number]>('VenueEventLineup')
VenueEventLineupRef.implement({
    fields: (t) => ({
        artist: t.field({ type: VenueEventLineupArtistRef, resolve: (l) => l.artists }),
    }),
})

const VenueEventAttendanceRef = builder.objectRef<VenueEvent['attendance'][number]>('VenueEventAttendance')
VenueEventAttendanceRef.implement({
    fields: (t) => ({
        status: t.exposeString('status'),
        // Texto libre ("Campo General") — issue #28, usado en "el plano" de la ficha de Sede.
        zone: t.exposeString('zone', { nullable: true }),
    }),
})

const VenueEventRef = builder.objectRef<VenueEvent>('VenueEvent')
VenueEventRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        name: t.exposeString('name', { nullable: true }),
        date: t.exposeString('date'),
        lineups: t.field({ type: [VenueEventLineupRef], resolve: (e) => e.lineups ?? [] }),
        attendance: t.field({ type: [VenueEventAttendanceRef], resolve: (e) => e.attendance ?? [] }),
    }),
})

const VenueTipRef = builder.objectRef<VenueTip>('VenueTip')
VenueTipRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        category: t.exposeString('category'),
        body: t.exposeString('body'),
        createdAt: t.exposeString('created_at'),
    }),
})

export const VenueRef = builder.objectRef<Venue | VenueWithEvents>('Venue')

VenueRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        name: t.exposeString('name'),
        address: t.exposeString('address', { nullable: true }),
        city: t.exposeString('city', { nullable: true }),
        country: t.exposeString('country', { nullable: true }),
        lat: t.exposeFloat('lat', { nullable: true }),
        lng: t.exposeFloat('lng', { nullable: true }),
        status: t.exposeString('status', { nullable: true }),
        // `getVenues()` no trae la relación y `getVenueById()` sí, así que el
        // campo la carga bajo demanda solo cuando no vino ya resuelta — para
        // que pedir `events` desde la query de listado devuelva el historial
        // real y no un array vacío silencioso.
        events: t.field({
            type: [VenueEventRef],
            resolve: (venue, _args, context) =>
                'events' in venue ? venue.events : context.venueEventsLoader.load(venue.id),
        }),
        // Issue #60 — siempre vía DataLoader, a diferencia de `events`: no hay
        // ningún query de venues que los traiga embebidos de entrada.
        tips: t.field({
            type: [VenueTipRef],
            resolve: (venue, _args, context) => context.venueTipsLoader.load(venue.id),
        }),
    }),
})

builder.queryField('venues', (t) =>
    t.field({
        type: [VenueRef],
        resolve: () => listVenues(),
    })
)

builder.queryField('venue', (t) =>
    t.field({
        type: VenueRef,
        nullable: true,
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: (_root, args) => findVenueById(String(args.id)),
    })
)

const VenueCreateInput = builder.inputType('VenueCreateInput', {
    fields: (t) => ({
        name: t.string({ required: true }),
        city: t.string(),
        address: t.string(),
        country: t.string(),
    }),
})

// Payload en vez de tirar un GraphQL error: un nombre duplicado no es una
// falla del sistema, es un resultado de negocio esperable — mismo criterio
// que ya usaba insertVenue() cuando la llamaba una Server Action.
const CreateVenueResultRef = builder.objectRef<{ id?: string; existingId?: string; error?: string }>(
    'CreateVenueResult'
)
CreateVenueResultRef.implement({
    fields: (t) => ({
        id: t.exposeID('id', { nullable: true }),
        existingId: t.exposeID('existingId', { nullable: true }),
        error: t.exposeString('error', { nullable: true }),
    }),
})

builder.mutationField('createVenue', (t) =>
    t.field({
        type: CreateVenueResultRef,
        args: {
            input: t.arg({ type: VenueCreateInput, required: true }),
        },
        resolve: (_root, args) =>
            insertVenue({
                name: args.input.name,
                city: args.input.city ?? undefined,
                address: args.input.address ?? undefined,
                country: args.input.country ?? undefined,
            }),
    })
)

const FindOrCreateVenueResultRef = builder.objectRef<{ id?: string; error?: string }>('FindOrCreateVenueResult')
FindOrCreateVenueResultRef.implement({
    fields: (t) => ({
        id: t.exposeID('id', { nullable: true }),
        error: t.exposeString('error', { nullable: true }),
    }),
})

builder.mutationField('findOrCreateVenue', (t) =>
    t.field({
        type: FindOrCreateVenueResultRef,
        description: 'Busca una sede por nombre o la crea si no existe — para autocompletado inline.',
        args: {
            name: t.arg.string({ required: true }),
            city: t.arg.string(),
            country: t.arg.string(),
        },
        resolve: (_root, args) => findOrCreateVenue(args.name, args.city ?? undefined, args.country ?? undefined),
    })
)

builder.mutationField('addVenueTip', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            venueId: t.arg.id({ required: true }),
            body: t.arg.string({ required: true }),
            category: t.arg.string({ required: true }),
        },
        resolve: async (_root, args) =>
            toMutationResult(
                await addVenueTip(String(args.venueId), args.body, args.category as VenueTipCategory)
            ),
    })
)

builder.mutationField('removeVenueTip', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: async (_root, args) => toMutationResult(await removeVenueTip(String(args.id))),
    })
)
