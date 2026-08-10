/**
 * Normaliza un tag crudo (de Last.fm o cualquier fuente externa) contra el
 * vocabulario curado de géneros. Pura y determinística: nunca adivina — si
 * el tag normalizado no tiene una fila en `aliases`, o esa fila mapea a
 * null (tag de ruido conocido como "live"/"seen live"), devuelve null en vez
 * de forzar un match.
 */
export function normalizeGenre(
  raw: string,
  aliases: ReadonlyMap<string, string | null>,
  keys: ReadonlySet<string>
): string | null {
  const normalized = collapse(raw)
  if (!aliases.has(normalized)) return null

  const genreKey = aliases.get(normalized) ?? null
  if (genreKey === null) return null

  return keys.has(genreKey) ? genreKey : null
}

function collapse(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
