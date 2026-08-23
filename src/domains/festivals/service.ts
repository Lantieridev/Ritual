import { getFestivals, getFestivalById } from './data'
import type { Festival } from './data'

export type { Festival }

/**
 * Use-case / application-service layer for the festivals domain.
 *
 * Server Components (app/page, app/coleccion, app/festivals/[id]) and the
 * GraphQL resolver (src/graphql/festivals.ts) call through here instead of
 * importing ./data directly — see issue #25. This is the seam: swapping the
 * data source or schema later (moving off Supabase, renaming a column) only
 * requires changes in data.ts and here, never in a page component or the
 * GraphQL layer.
 *
 * Unlike expenses, there is no cross-domain "picker" read to expose here:
 * app/festivals/nuevo doesn't need to read from another domain to render its
 * form. Mutations are deliberately NOT wrapped here either, for the same
 * reason as expenses — actions.ts already plays that role for writes: it
 * validates input, returns the shared `ActionResult<T>` shape, and its
 * redirect-free core functions (insertFestival/removeFestival/
 * saveFestivalAttendance/linkEventToFestival) are already reused as-is by
 * both the Server Actions and the GraphQL mutations. Adding another
 * pass-through layer in front of it would duplicate that seam, not
 * strengthen it, so the write side is intentionally left alone.
 */

/** Lists the current user's festivals, most recent first. */
export async function listFestivals(): Promise<Festival[]> {
  return getFestivals()
}

/** Finds one festival by id, scoped to its owner via RLS. */
export async function findFestivalById(id: string): Promise<Festival | null> {
  return getFestivalById(id)
}
