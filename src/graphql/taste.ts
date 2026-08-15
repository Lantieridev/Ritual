import { builder } from './builder'
import { listGenres } from '@/src/domains/taste/service'
import type { GenreOption } from '@/src/domains/taste/service'

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
