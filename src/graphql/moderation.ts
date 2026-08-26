import { GraphQLError } from 'graphql'
import { builder } from './builder'
import { ArtistRef } from './artists'
import { VenueRef } from './venues'
import { EventRef } from './events'
import { MutationResultRef, toMutationResult } from './shared'
import type { GraphQLContext } from './context'
import {
    listUnverifiedArtists,
    listUnverifiedVenues,
    listUnverifiedEvents,
    searchMergeTargets,
    approveArtist,
    approveVenue,
    approveEvent,
    mergeArtists,
    mergeVenues,
    mergeEvents,
    type MergeTarget,
} from '@/src/domains/moderation/service'

/**
 * Se tira GraphQLError y no Error a secas: yoga enmascara cualquier throw que
 * no sea GraphQLError como "Unexpected error.", y una denegación de permisos
 * es accionable por el cliente, no una falla interna. Sin esto la UI de
 * moderación no puede distinguir "no tenés permiso" de "se rompió el server".
 */
function requireModerator(context: GraphQLContext) {
    if (context.role !== 'admin' && context.role !== 'moderador') {
        throw new GraphQLError('Unauthorized', { extensions: { code: 'FORBIDDEN' } })
    }
}

/**
 * Un solo field con arg de tipo en vez de tres (`mergeArtistTargets`, …): las
 * tres pantallas de moderación consumen el mismo combobox con la misma forma
 * de resultado, así que separarlos multiplicaría el schema sin que el cliente
 * gane nada. Los `unverified*` sí van separados porque cada uno devuelve un
 * tipo de entidad distinto.
 */
export const ModeratedEntityEnum = builder.enumType('ModeratedEntity', {
    values: ['artists', 'venues', 'events'] as const,
})

const MergeTargetRef = builder.objectRef<MergeTarget>('MergeTarget')
MergeTargetRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        name: t.exposeString('name'),
        detail: t.exposeString('detail', { nullable: true }),
    }),
})

builder.queryField('unverifiedArtists', (t) =>
    t.field({
        type: [ArtistRef],
        resolve: async (_root, _args, context) => {
            requireModerator(context)
            return listUnverifiedArtists()
        },
    })
)

builder.queryField('unverifiedVenues', (t) =>
    t.field({
        type: [VenueRef],
        resolve: async (_root, _args, context) => {
            requireModerator(context)
            return listUnverifiedVenues()
        },
    })
)

builder.queryField('unverifiedEvents', (t) =>
    t.field({
        type: [EventRef],
        resolve: async (_root, _args, context) => {
            requireModerator(context)
            return listUnverifiedEvents()
        },
    })
)

builder.queryField('mergeTargets', (t) =>
    t.field({
        type: [MergeTargetRef],
        description: 'Entidades verificadas que pueden recibir una fusión, buscadas por nombre.',
        args: {
            entityType: t.arg({ type: ModeratedEntityEnum, required: true }),
            query: t.arg.string({ required: true }),
            excludeId: t.arg.id(),
        },
        resolve: async (_root, args, context) => {
            requireModerator(context)
            return searchMergeTargets(
                args.entityType,
                args.query,
                args.excludeId ? String(args.excludeId) : undefined
            )
        },
    })
)

builder.mutationField('approveArtist', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: async (_root, args, context) => {
            requireModerator(context)
            try {
                await approveArtist(String(args.id))
                return toMutationResult({})
            } catch (error) {
                return toMutationResult({ error: (error as Error).message })
            }
        },
    })
)

builder.mutationField('approveVenue', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: async (_root, args, context) => {
            requireModerator(context)
            try {
                await approveVenue(String(args.id))
                return toMutationResult({})
            } catch (error) {
                return toMutationResult({ error: (error as Error).message })
            }
        },
    })
)

builder.mutationField('approveEvent', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: async (_root, args, context) => {
            requireModerator(context)
            try {
                await approveEvent(String(args.id))
                return toMutationResult({})
            } catch (error) {
                return toMutationResult({ error: (error as Error).message })
            }
        },
    })
)

builder.mutationField('mergeArtists', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            sourceId: t.arg.id({ required: true }),
            targetId: t.arg.id({ required: true }),
        },
        resolve: async (_root, args, context) => {
            requireModerator(context)
            try {
                await mergeArtists(String(args.sourceId), String(args.targetId))
                return toMutationResult({})
            } catch (error) {
                return toMutationResult({ error: (error as Error).message })
            }
        },
    })
)

builder.mutationField('mergeVenues', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            sourceId: t.arg.id({ required: true }),
            targetId: t.arg.id({ required: true }),
        },
        resolve: async (_root, args, context) => {
            requireModerator(context)
            try {
                await mergeVenues(String(args.sourceId), String(args.targetId))
                return toMutationResult({})
            } catch (error) {
                return toMutationResult({ error: (error as Error).message })
            }
        },
    })
)

builder.mutationField('mergeEvents', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            sourceId: t.arg.id({ required: true }),
            targetId: t.arg.id({ required: true }),
        },
        resolve: async (_root, args, context) => {
            requireModerator(context)
            try {
                await mergeEvents(String(args.sourceId), String(args.targetId))
                return toMutationResult({})
            } catch (error) {
                return toMutationResult({ error: (error as Error).message })
            }
        },
    })
)
