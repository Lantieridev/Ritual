import { builder } from './builder'

builder.queryField('ping', (t) =>
    t.string({
        resolve: () => 'pong',
    })
)
