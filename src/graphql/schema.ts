import { builder } from './builder'
import './shared'
import './health'
import './venues'
import './artists'
import './festivals'
import './expenses'
import './auth'
import './stats'
import './events'
import './moderation'
// Cada dominio nuevo se suma aquí con su propio import de efecto lateral,
// mismo patrón que health.ts — el archivo del dominio llama a
// builder.queryField/mutationField y no exporta nada directamente.

export const schema = builder.toSchema()
