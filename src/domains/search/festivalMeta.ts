/**
 * Segunda línea de un resultado de festival: preferimos la edición ("2026")
 * porque identifica la instancia concreta del festival; si no está cargada,
 * la ciudad es la siguiente dato real disponible. Nunca se inventa un valor
 * — si ninguno de los dos existe, no hay meta que mostrar.
 *
 * Usado tanto por la sección de festivales del archivo de escritorio
 * (`app/buscar/page.tsx`) como por `toSearchRows` (mobile, WU3) — misma
 * regla, una sola fuente de verdad.
 */
export function festivalMetaLine(edition: string | null, city: string | null): string | null {
    if (edition) return `Festival · ${edition}`
    if (city) return `Festival · ${city}`
    return null
}
