# Estructura del proyecto RITUAL

Objetivo: **dominios claros**, **core compartido** y **app delgada** (solo rutas y composición). Así escalamos a gastos, perfil y red sin desorden.

---

## Estructura actual (implementada)

```
src/
  core/                      # Lo que usa toda la app
    auth/
      session.ts             # getCurrentUserId() — fuente única de verdad de sesión en el server
    lib/
      supabase/
        server.ts            # Cliente de Supabase para Server Components/Actions
        middleware.ts        # Cliente de Supabase usado por proxy.ts (auth guard)
                              # (no hay client.ts — se eliminó, ningún Client Component
                              # necesita Supabase directo hoy; ver ADR 0002)
      routes.ts               # Rutas centralizadas (evita strings mágicos)
      dates.ts, validation.ts, env.ts, spotify.ts, lastfm.ts…
    types/
      index.ts                # Tipos de dominio (Artist, Venue, Event, Expense…)
    components/
      ui/                     # Primitivos del sistema de diseño: Button, Card, Input, TicketEmbed, StarRating…
      layout/                 # Navbar, Footer, PageShell
      home/                   # Piezas compuestas específicas del Home

  domains/                    # Un folder por dominio (datos + acciones/servicio + vistas + componentes)
    events/                    # Híbrido: alta/edición/borrado de evento ya es GraphQL,
                                # asistencia y fotos siguen como Server Action.
      data.ts                 # getEvents, getEventById, getEventsWithAttendance
      service.ts               # insertEvent, modifyEvent, removeEvent, addExternalEvent
                                # — casos de uso detrás de las mutations de src/graphql/events.ts
                                # (actions.ts se borró cuando se migró, PR #49)
      attendance-data.ts / attendance-actions.ts   # Server Actions, sin migrar
      photo-actions.ts                              # Server Action, sin migrar
      home-view.ts             # Lógica pura para el hero del Home (testeada sin renderizar)
      components/
    venues/                    # 100% GraphQL — sin actions.ts
      service.ts
    artists/                   # 100% GraphQL — sin actions.ts
      collection-view.ts       # Lógica pura para Colección (artistas+sedes+festivales)
      enrichment.ts             # Enriquecimiento con Spotify/Last.fm
      service.ts, wishlist-service.ts
    festivals/                 # 100% GraphQL — sin actions.ts
      service.ts, write-service.ts
    expenses/                  # 100% GraphQL — sin actions.ts. Gastos personales, privados por usuario (RLS)
      service.ts, categories.ts, comparisons.ts, grouping.ts
    stats/
      wrapped-view.ts           # Lógica del resumen anual "Wrapped"
    auth/                       # Híbrido: edición de perfil ya es GraphQL (service.ts →
                                 # updateProfile), login/signup/signout/reset de contraseña
                                 # siguen en src/core/auth/actions.ts (Server Actions).
      service.ts, data.ts
      avatar-actions.ts         # Server Action a propósito: recibe un File por FormData,
                                 # y Yoga no tiene un scalar Upload configurado.
    showmode/                   # "Modo recital activo" (issue #9) — checklist pre-show,
                                 # ventana configurable, tarjeta-recuerdo. 100% Server Actions,
                                 # no migró en esta tanda.
      actions.ts, service.ts, data.ts, checklist.ts, pending.ts, preferences.ts, window.ts, memory-card.ts
    weather/                    # Clima exacto del show vía Open-Meteo (issue #8). Servicio de
                                 # servidor puro: sin actions.ts ni resolver GraphQL, se llama
                                 # directo desde Server Components.
      open-meteo.ts, weather-service.ts, icons.ts

  graphql/                     # Capa GraphQL (Pothos + Yoga), migración progresiva desde
                                # Server Actions — ver issue #23 y ADR 0004. Un archivo de
                                # schema por dominio migrado: artists.ts, auth.ts, events.ts,
                                # expenses.ts, festivals.ts, stats.ts, venues.ts.
    builder.ts                 # Instancia de Pothos SchemaBuilder
    schema.ts                  # Ensambla el schema final a partir de los archivos por dominio
    context.ts                 # createGraphQLContext — cliente Supabase + userId por request
    client.ts                  # Cliente urql (Server Components) — apunta a yoga.fetch
                                # in-process, nunca hace un round-trip HTTP real
    yoga.ts                    # Instancia de GraphQL Yoga, montada en app/api/graphql/route.ts
    shared.ts, mutation-result.ts  # MutationResultRef + unwrapMutation: el shape común de
                                    # resultado de mutation que consumen los Client Components
    provider.tsx                # Provider de urql para Client Components
    health.ts                   # Query de healthcheck

app/                           # Solo rutas y páginas (importan de src/core, src/domains, src/graphql)
  api/graphql/                 # Endpoint único de GraphQL (Yoga) — route.ts reexporta
                                # yoga.handleRequest en GET/POST/OPTIONS
  page.tsx                     # Home
  layout.tsx
  coleccion/                   # Artistas + Sedes + Festivales unificados
  events/, venues/, artists/, festivals/, expenses/, stats/, wishlist/, wrapped/
  login/, signup/, profile/, modo-recital/
  buscar/ (activa) — search/ (alias legado, ver R2-009)

proxy.ts                       # Auth guard + refresh de cookies (antes middleware.ts, ver docs/adr)
```

### Diseño (Tailwind 4)

- Sistema de tokens `ritual-*` en `app/globals.css` (`@theme inline`, CSS-first, sin `tailwind.config.js`): colores, sombras y motion namespaced.
- Tipografía: 7 fuentes de Google Fonts vía `next/font/google` (Anton, Archivo Black, Archivo, Big Shoulders, Bebas Neue, Space Mono, Space Grotesk).
- `--radius-*` global en `0px`: todos los `rounded-*` quedan planos por diseño (excepto `rounded-full`).
- Accesibilidad WCAG 2.2 AA verificada con cálculo real de contraste (no a ojo) — ver auditoría en el historial de commits de julio/agosto 2026.

### Ventajas

- **Dominios**: Todo lo de "eventos" está en `domains/events/`. Al agregar una feature nueva, todo va en su propio `domains/<nombre>/`.
- **Core**: Tipos, Supabase, rutas y componentes UI/layout en un solo lugar. No se mezclan con lógica de un dominio.
- **Imports**: Desde cualquier página: `@/src/domains/events/data`, `@/src/core/components/ui`, `@/src/core/types`.
- **Escalabilidad**: Nueva feature = nueva carpeta en `domains/` (y su equivalente en `graphql/` si ya migró) + rutas en `app/`.

### Imports

- Páginas en `app/`: importan de `@/src/core/*`, `@/src/domains/*` y `@/src/graphql/*` — este último ya es el camino principal de escritura para `artists`, `expenses`, `festivals` y `venues`, y de lectura server-side vía `getClient().query()` donde se migró (ver `docs/adr/0004-graphql-migration-strangler-fig.md`).
- Dentro de un dominio: `data.ts`, `service.ts` y (donde sigue existiendo) `actions.ts` importan de `@/src/core/lib/supabase/server` y `@/src/core/types`.
- Resolvers en `src/graphql/<dominio>.ts`: importan las funciones de `service.ts`/`data.ts` del dominio correspondiente — nunca acceden a Supabase directamente.
- Componentes de dominio: importan de `@/src/core/components/ui`, `@/src/core/lib/routes` y, para mutaciones ya migradas, `useMutation` de `urql` + `unwrapMutation` de `@/src/graphql/mutation-result`.

---

## Gastos (expenses)

- **Tabla**: `expenses` con `user_id` (dueño del gasto). Solo ese usuario ve/edita/borra (RLS).
- **Información personal**: No se comparte con otros usuarios; cuando haya red social, los gastos siguen privados.
- **Campos**: user_id, amount, category, note, event_id (opcional, para asociar a un recital), date.
- **Rutas**: `/expenses` (listado), `/expenses/nuevo` (formulario), `/expenses/[id]/editar`.
- Sin sesión, `requireUserId()` devuelve un error de "iniciá sesión" — no hay bypass de desarrollo (el `RITUAL_DEV_USER_ID` de versiones tempranas del proyecto ya no existe; usá un usuario real de Supabase Auth).
- **Capa de datos**: `src/domains/expenses/service.ts` (casos de uso) + `data.ts`, `categories.ts`, `comparisons.ts`, `grouping.ts`. Expuesto íntegramente por GraphQL (`src/graphql/expenses.ts`) — no queda `actions.ts` en este dominio.

---

## UX y metadata

- **Loading**: `app/loading.tsx` (global) y `loading.tsx` por segmento (evento, gastos, etc.) para evitar pantalla en blanco.
- **Error**: `app/error.tsx` (global) y `error.tsx` por segmento, con mensaje + Reintentar / Volver.
- **404**: `app/not-found.tsx` global, más `not-found.tsx` por segmento cuando el recurso no existe.
- **Metadata**: Todas las páginas tienen título (y descripción donde aplica) vía `metadata`/`generateMetadata`, siempre con sufijo `| RITUAL`.
- **Estados vacíos**: mensaje + CTA en cada listado vacío (ej. "Agregar primer recital", "+ Nuevo artista").
