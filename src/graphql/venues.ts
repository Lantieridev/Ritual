import { builder } from './builder'
import { getVenues, getVenueById } from '@/src/domains/venues/data'

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
