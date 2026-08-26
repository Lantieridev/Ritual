# Handoff: Claude Design - UI de Moderación (Ritual)

Este documento contiene el contexto técnico y funcional necesario para que Claude Design (o cualquier agente de UI) pueda refinar, animar o reconstruir las pantallas de Moderación de Ritual sin romper la lógica de negocio ni la integración con GraphQL.

## Contexto de Arquitectura
- **Stack**: Next.js App Router (React 19), Tailwind CSS v4, `urql` para GraphQL.
- **Tema Visual**: Brutalista, oscuro. Fondos `bg-ritual-bg` y `bg-ritual-panel`, texto `text-ritual-bone`, acentos `text-ritual-red-hover`. Tipografías `font-display`, `font-dense`, `font-label`. Sin íconos pesados, usar caracteres ASCII (`✓`, `→`) o trazos minimalistas.
- **Paradigma de Moderación**: Post-moderación. Los registros se muestran acá si tienen `status = 'unverified'`. El moderador tiene dos opciones: **Aprobar** (marca como verificado) o **Fusionar** (destruye el registro actual y mueve su data histórica a un ID canónico).

---

## 1. Pantalla: Moderación de Artistas (`/admin/moderacion/artistas`)

### Datos de Entrada (GraphQL)
```graphql
query getUnverifiedArtists {
  unverifiedArtists {
    id
    name
    genre
    status
  }
}
```

### Acciones Requeridas (Mutations)
1. **Aprobar:**
   ```graphql
   mutation ApproveArtist($id: ID!) {
     approveArtist(id: $id) { success }
   }
   ```
2. **Fusionar:**
   ```graphql
   mutation MergeArtists($sourceId: ID!, $targetId: ID!) {
     mergeArtists(sourceId: $sourceId, targetId: $targetId) { success }
   }
   ```

### UX & Animaciones (Crítico)
- **Instalar y usar `framer-motion`**. El usuario exige que la interfaz sea **extremadamente "smooth" y fluida**.
- **Acción Aprobar:** Al hacer clic, usar `<AnimatePresence>` para que la fila entera colapse suavemente y desaparezca (animando `height` a 0 y `opacity` a 0).
- **Acción Fusionar:** En lugar de abrir un modal genérico, la fila debe hacer un **Layout Animation** y expandirse fluidamente para revelar el buscador de la entidad canónica.
- Las transiciones deben tener un feeling "premium" (springs suaves) pero manteniendo la estética brutalista.

### Cómo se elige la entidad canónica (decidido 2026-08-25)

Se busca por nombre, no se pega un UUID. El input de UUID pelado quedó descartado
por cuatro razones verificadas contra el código:

- El unique sobre `name_key` (`20260712000000_venues_artists_name_unique.sql`) hace
  imposible el duplicado exacto en `artists` y `venues`. Todo lo que llega a la cola
  es un *casi*-duplicado ("Radiohead" vs "Radiohead UK"), así que buscar por nombre
  exacto no sirve.
- El servidor MCP ya le da búsqueda a la IA: el tool `search_catalog` en
  `mcp/src/index.ts` está descripto como "para encontrar el ID canónico antes de
  fusionar". El `01-spec.md` §5 declara UI humana y MCP como clientes pares; darle
  buscador a uno y pegado de UUID al otro rompe esa paridad.
- Los índices GIN trigram sobre `artists.name`, `venues.name` y `events.name` ya
  existen (`20260824205500_performance_indexes.sql`). La búsqueda no cuesta trabajo
  de base de datos.
- Para conseguir un UUID el moderador tendría que salir de `/admin`, ir a `/buscar`,
  abrir la entidad y copiarlo de la URL — para después ejecutar una operación
  destructiva e irreversible.

**Componente:** se reusa `src/core/components/ui/Combobox.tsx`, que ya existe, está
testeado, tiene la estética correcta y es accesible por teclado (`role="combobox"`,
`role="listbox"`, `role="option"`). Sus props `excludeIds` (para dejar afuera la
entidad origen) y `sublabel` (género, ciudad, fecha) cubren exactamente este caso.
Ya lo consume `EventForm`.

**Fuente de datos:** query `mergeTargets`, espejo semántico de `search_catalog`
(sólo `status = 'verified'`, `ilike`, con límite). No se precarga el catálogo
completo: `artists` y `venues` devuelven listas sin límite pero `events` es una
Relay connection paginada por diseño, y precargar daría dos UX divergentes dentro
de la misma familia de pantallas.

---

## 2. Pantalla: Moderación de Sedes (`/admin/moderacion/sedes`)

### Datos de Entrada
```graphql
query getUnverifiedVenues {
  unverifiedVenues {
    id
    name
    city
    address
    status
  }
}
```

### Acciones Requeridas
1. **Aprobar:** `approveVenue(id: ID!)`
2. **Fusionar:** `mergeVenues(sourceId: ID!, targetId: ID!)`

### UX & Animaciones (Crítico)
- Misma exigencia de `framer-motion` para las interacciones de tabla.
- Debe mostrar claramente la ciudad y dirección para discernir si es un estadio duplicado (ej. "River Plate" vs "Estadio Mas Monumental").

---

## 3. Pantalla: Moderación de Eventos (`/admin/moderacion/eventos`)

### Datos de Entrada
```graphql
query getUnverifiedEvents {
  unverifiedEvents {
    id
    name
    date
    status
    venue { name }
    lineups { artist { name } }
  }
}
```

### Acciones Requeridas
1. **Aprobar:** `approveEvent(id: ID!)`
2. **Fusionar:** `mergeEvents(sourceId: ID!, targetId: ID!)`

### UX & Animaciones (Crítico)
- Es la vista más compleja. Aplican las mismas layout animations.
- El panel expansible de "Fusión" tiene que tener una animación de advertencia (quizás un shake sutil o un resaltado rojo en delay) remarcando fuertemente que "Fusionar eventos moverá todas las asistencias al evento destino".

---

## 4. Graceful Degradation y Timeouts (Core Architecture)

- **Resiliencia de Red**: Si en alguna vista intentás enriquecer datos usando Spotify o Ticketmaster (ej. mostrar la foto del artista al expandir), **asumí que la API puede fallar o colgarse**.
- El backend usa el wrapper `fetchWithTimeout` (`src/core/lib/http.ts`), que aborta la request a los 8 segundos. Los clientes externos nunca tiran: `searchSpotifyArtist` devuelve `{ artist: null, error: '...' }` incluso en el abort. El principio está fijado en el ADR `docs/adr/0003-optional-external-api-keys-graceful-degradation.md`.
- **UI Contract**: La interfaz **NO DEBE** explotar ni quedar en loaders infinitos. Diseñá estados vacíos (empty states) sutiles y elegantes si falta data de terceros, priorizando siempre mostrar la información crítica (la de nuestra base de datos en Supabase) para que el flujo de moderación continúe sin interrupciones.
- **Aplicado a estas pantallas**: hoy las tres hacen `throw new Error(result.error.message)` si falla el query de la cola, lo que produce una pantalla de error en vez de una vista degradada. La convención del repo es la contraria — `getArtists()` loguea y devuelve `[]`, y `app/events/nuevo/page.tsx` hace `data?.venues ?? []`. Las pantallas de moderación tienen que alinearse con eso: la cola de Supabase siempre se muestra y siempre se puede operar.
