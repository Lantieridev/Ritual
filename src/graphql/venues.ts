import { builder } from './builder'
import { getVenues, getVenueById } from '@/src/domains/venues/data'
import { insertVenue, findOrCreateVenue } from '@/src/domains/venues/actions'

export const VenueRef = builder.objectRef<{
    id: string
    name: string
    address?: string | null
    city?: string | null
    country?: string | null
    lat?: number | null
    lng?: number | null
}>('Venue')

VenueRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        name: t.exposeString('name'),
        address: t.exposeString('address', { nullable: true }),
        city: t.exposeString('city', { nullable: true }),
        country: t.exposeString('country', { nullable: true }),
        lat: t.exposeFloat('lat', { nullable: true }),
        lng: t.exposeFloat('lng', { nullable: true }),
    }),
})

builder.queryField('venues', (t) =>
    t.field({
        type: [VenueRef],
        resolve: () => getVenues(),
    })
)

builder.queryField('venue', (t) =>
    t.field({
        type: VenueRef,
        nullable: true,
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: (_root, args) => getVenueById(String(args.id)),
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
// que ya usa insertVenue() del lado de las Server Actions (ActionResult).
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
