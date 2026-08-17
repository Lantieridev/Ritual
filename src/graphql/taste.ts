import { builder } from './builder'
import { listGenres, updateTasteProfile, connectLastfm, disconnectLastfm } from '@/src/domains/taste/service'
import type { GenreOption } from '@/src/domains/taste/service'
import { MutationResultRef, toMutationResult } from './shared'

const GenreRef = builder.objectRef<GenreOption>('Genre')
GenreRef.implement({
    fields: (t) => ({
        key: t.exposeString('key'),
        label: t.exposeString('label'),
    }),
})

builder.queryField('genres', (t) =>
    t.field({
        type: [GenreRef],
        description: 'Vocabulario canónico de géneros musicales, ordenado para el picker de signup y perfil.',
        resolve: () => listGenres(),
    })
)

const TasteProfileUpdateInput = builder.inputType('TasteProfileUpdateInput', {
    fields: (t) => ({
        genres: t.stringList({ required: true }),
        birthYear: t.int(),
    }),
})

builder.mutationField('updateTasteProfile', (t) =>
    t.field({
        type: MutationResultRef,
        description: 'Reemplaza los géneros favoritos y el año de nacimiento declarados por el usuario actual.',
        args: {
            input: t.arg({ type: TasteProfileUpdateInput, required: true }),
        },
        resolve: async (_root, args) =>
            toMutationResult(
                await updateTasteProfile({
                    genres: [...args.input.genres],
                    birthYear: args.input.birthYear ?? null,
                })
            ),
    })
)

builder.mutationField('connectLastfm', (t) =>
    t.field({
        type: MutationResultRef,
        description: 'Conecta un usuario de Last.fm e importa sus artistas más escuchados antes de responder.',
        args: {
            username: t.arg.string({ required: true }),
        },
        resolve: async (_root, args) => toMutationResult(await connectLastfm(args.username)),
    })
)

builder.mutationField('disconnectLastfm', (t) =>
    t.field({
        type: MutationResultRef,
        description: 'Desconecta Last.fm: borra los artistas importados y limpia el usuario guardado.',
        resolve: async () => toMutationResult(await disconnectLastfm()),
    })
)
