/**
 * Routes the installed PWA must be able to open with no signal. Fetching
 * them once while online, from a page the service worker controls, is what
 * puts them in its runtime cache — they sit behind auth, so they can't be
 * precached at build time.
 */
export const OFFLINE_ROUTES = ['/', '/expenses/nuevo'] as const

export async function warmOfflineRoutes(fetchFn: typeof fetch = fetch): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  await Promise.allSettled(OFFLINE_ROUTES.map((url) => fetchFn(url, { credentials: 'same-origin' })))
}
