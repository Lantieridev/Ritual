import { createYoga } from 'graphql-yoga'
import { schema } from '@/src/graphql/schema'
import { createGraphQLContext } from '@/src/graphql/context'

const yoga = createYoga({
    schema,
    context: createGraphQLContext,
    graphqlEndpoint: '/api/graphql',
    fetchAPI: { Response },
})

// Envueltas con nuestra propia firma (en vez de reexportar
// yoga.handleRequest directo) porque el validador de tipos de rutas de
// Next.js espera (request, { params }) y el segundo parámetro de Yoga no
// matchea esa forma estructuralmente.
export async function GET(request: Request) {
    return yoga.handleRequest(request, {})
}

export async function POST(request: Request) {
    return yoga.handleRequest(request, {})
}

export async function OPTIONS(request: Request) {
    return yoga.handleRequest(request, {})
}
