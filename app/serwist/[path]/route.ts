import { createSerwistRoute } from '@serwist/turbopack'

// Revision versions the precached offline fallback so a new deploy replaces it.
// `||` (not `??`): outside a git checkout the env var is simply unset.
const revision = process.env.VERCEL_GIT_COMMIT_SHA || crypto.randomUUID()

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: '/~offline', revision }],
  swSrc: 'app/sw.ts',
  useNativeEsbuild: true,
})
