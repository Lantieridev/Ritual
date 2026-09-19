import { defaultCache } from '@serwist/turbopack/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
})

// A page that isn't cached and can't be fetched (offline, first visit) falls
// back to a plain "sin conexión" page instead of the browser's dino.
serwist.setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') {
    const fallback = await serwist.matchPrecache('/~offline')
    if (fallback) return fallback
  }
  return Response.error()
})

serwist.addEventListeners()
