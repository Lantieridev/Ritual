/**
 * Pura, sin I/O — issue #28. "El plano" de la ficha de Sede pedía un dibujo
 * a escala del escenario y las zonas del lugar con un punto por visita; sin
 * ninguna geometría real por sede en el modelo de datos (el issue lo deja
 * como "catálogo opcional"), inventar coordenadas para dibujar un plano que
 * no representa el lugar real sería peor que no tener plano. Esto resuelve
 * la parte que sí tiene datos reales: cuántas noches estuvo el usuario en
 * cada zona, texto tal cual lo cargó.
 */
export interface ZoneVisitEvent {
  attendance: Array<{ status: string; zone: string | null }>
}

export interface ZoneTally {
  zone: string
  count: number
}

/**
 * Cuenta noches "fui" por zona, de más a menos visitada. Sólo cuenta
 * attendance con status 'went' -"voy a ir"/"me interesa" a un show futuro
 * nunca tiene una zona real todavía, aunque el campo esté cargado.
 *
 * Tal cual como el usuario la escribió: sin catálogo de zonas por venue no
 * hay una forma no arbitraria de decidir si "Campo" y "campo" son la misma
 * zona o dos error tipográficos distintos, así que agrupa por texto exacto.
 */
export function tallyZonesVisited(events: ZoneVisitEvent[]): ZoneTally[] {
  const counts = new Map<string, number>()

  for (const event of events) {
    for (const att of event.attendance) {
      if (att.status !== 'went') continue
      const zone = att.zone?.trim()
      if (!zone) continue
      counts.set(zone, (counts.get(zone) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([zone, count]) => ({ zone, count }))
    .sort((a, b) => b.count - a.count)
}
