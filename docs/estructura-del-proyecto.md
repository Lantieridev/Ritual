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
        client.ts            # Cliente de Supabase para Client Components
        middleware.ts        # Cliente de Supabase usado por proxy.ts (auth guard)
      routes.ts               # Rutas centralizadas (evita strings mágicos)
      dates.ts, validation.ts, env.ts, spotify.ts, lastfm.ts…
    types/
      index.ts                # Tipos de dominio (Artist, Venue, Event, Expense…)
    components/
      ui/                     # Primitivos del sistema de diseño: Button, Card, Input, TicketEmbed, StarRating…
      layout/                 # Navbar, Footer, PageShell
      home/                   # Piezas compuestas específicas del Home

  domains/                    # Un folder por dominio (datos + acciones + vistas + componentes)
    events/
      data.ts                 # getEvents, getEventById, getEventsWithAttendance
      actions.ts               # createEvent, updateEvent, deleteEvent
      attendance-data.ts / attendance-actions.ts
      photo-actions.ts
      home-view.ts             # Lógica pura para el hero del Home (testeada sin renderizar)
      components/
    venues/
    artists/
      collection-view.ts       # Lógica pura para Colección (artistas+sedes+festivales)
      enrichment.ts             # Enriquecimiento con Spotify/Last.fm
    festivals/
    expenses/                  # Gastos personales, privados por usuario (RLS)
    stats/
      wrapped-view.ts           # Lógica del resumen anual "Wrapped"
    auth/                       # Perfil, login/signup, acciones de sesión

  graphql/                     # Capa GraphQL (Pothos + Yoga), en migración progresiva
                                # desde Server Actions — ver issue #23. Un archivo por
                                # dominio (events.ts, artists.ts…), mismo split que domains/.
    builder.ts, schema.ts, context.ts

app/                           # Solo rutas y páginas (importan de src/core, src/domains, src/graphql)
  api/graphql/                 # Endpoint único de GraphQL (Yoga)
  page.tsx                     # Home
  layout.tsx
  coleccion/                   # Artistas + Sedes + Festivales unificados
  events/, venues/, artists/, festivals/, expenses/, stats/, wishlist/, wrapped/
  login/, signup/, profile/
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

- Páginas en `app/`: importan de `@/src/core/*`, `@/src/domains/*` y (progresivamente) `@/src/graphql/*`.
- Dentro de un dominio: `data.ts` y `actions.ts` importan de `@/src/core/lib/supabase/server` y `@/src/core/types`.
- Componentes de dominio: importan de `@/src/core/components/ui` y `@/src/core/lib/routes`.

---

## Gastos (expenses)

- **Tabla**: `expenses` con `user_id` (dueño del gasto). Solo ese usuario ve/edita/borra (RLS).
- **Información personal**: No se comparte con otros usuarios; cuando haya red social, los gastos siguen privados.
- **Campos**: user_id, amount, category, note, event_id (opcional, para asociar a un recital), date.
- **Rutas**: `/expenses` (listado), `/expenses/nuevo` (formulario), `/expenses/[id]/editar`.
- Sin sesión, `requireUserId()` devuelve un error de "iniciá sesión" — no hay bypass de desarrollo (el `RITUAL_DEV_USER_ID` de versiones tempranas del proyecto ya no existe; usá un usuario real de Supabase Auth).

---

## UX y metadata

- **Loading**: `app/loading.tsx` (global) y `loading.tsx` por segmento (evento, gastos, etc.) para evitar pantalla en blanco.
- **Error**: `app/error.tsx` (global) y `error.tsx` por segmento, con mensaje + Reintentar / Volver.
- **404**: `app/not-found.tsx` global, más `not-found.tsx` por segmento cuando el recurso no existe.
- **Metadata**: Todas las páginas tienen título (y descripción donde aplica) vía `metadata`/`generateMetadata`, siempre con sufijo `| RITUAL`.
- **Estados vacíos**: mensaje + CTA en cada listado vacío (ej. "Agregar primer recital", "+ Nuevo artista").
