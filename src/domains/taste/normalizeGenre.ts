export type GenreTagClass =
  | { kind: 'genre'; key: string }
  /** Curated alias that deliberately maps to no genre ("live", "seen live"). */
  | { kind: 'noise' }
  /** No alias row, or an alias pointing at a genre missing from the vocabulary: needs curation. */
  | { kind: 'unmapped' }

/**
 * Clasifica un tag crudo (de Last.fm o cualquier fuente externa) contra el
 * vocabulario curado de géneros. Pura y determinística: nunca adivina un
 * match, y distingue el ruido ya curado de lo que todavía nadie curó, para
 * que sólo lo segundo se reporte como pendiente.
 */
export function classifyGenreTag(
  raw: string,
  aliases: ReadonlyMap<string, string | null>,
  keys: ReadonlySet<string>
): GenreTagClass {
  const normalized = collapse(raw)
  if (!aliases.has(normalized)) return { kind: 'unmapped' }

  const genreKey = aliases.get(normalized) ?? null
  if (genreKey === null) return { kind: 'noise' }

  return keys.has(genreKey) ? { kind: 'genre', key: genreKey } : { kind: 'unmapped' }
}

/** El género canónico del tag, o null si es ruido o no está mapeado. */
export function normalizeGenre(
  raw: string,
  aliases: ReadonlyMap<string, string | null>,
  keys: ReadonlySet<string>
): string | null {
  const tag = classifyGenreTag(raw, aliases, keys)
  return tag.kind === 'genre' ? tag.key : null
}

function collapse(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
