import { builder } from './builder'
import './health'
// Cada dominio nuevo (Fase 7.2+) se suma acá con su propio import de efecto
// lateral, mismo patrón que health.ts — el archivo del dominio llama a
// builder.queryField/mutationField y no exporta nada directamente.

export const schema = builder.toSchema()
