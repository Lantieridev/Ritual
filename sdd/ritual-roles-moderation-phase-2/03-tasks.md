# Tareas: Fase 2 - Cola de Moderación & MCP

> Estado auditado contra el working tree el 2026-08-25. Los tildes reflejan lo
> que existe en el código, no lo que se planeó.

## Task 1: Capa de Datos (Supabase)

Migración: `supabase/migrations/20260824202000_moderation_queue.sql`

- [x] Crear migración SQL para el enum `verification_status` (`unverified`, `verified`).
- [x] Agregar la columna `status` (tipo `verification_status`, default `unverified`) a las tablas `artists`, `venues` y `events`.
- [x] Escribir la función RPC `merge_artists(source_id UUID, target_id UUID)`.
- [x] Escribir la función RPC `merge_venues(source_id UUID, target_id UUID)`.
- [x] Escribir la función RPC `merge_events(source_id UUID, target_id UUID)`.

Entregado además de lo planeado: columna `created_by` con FK a `auth.users`, y
un trigger `check_creation_rate_limit()` que limita altas por hora a los roles
sin privilegios. Los tres RPC son `SECURITY DEFINER` y validan
`get_user_role(auth.uid()) IN ('admin','moderador')` en su cuerpo, así que el
`GRANT EXECUTE ... TO authenticated` no abre un agujero.

## Task 1b: Corregir el camino de aprobación (BLOQUEANTE — descubierto en auditoría)

`approve*` no pasa por RPC: hace `supabase.from(tabla).update({status:'verified'})`
con el cliente de `@supabase/ssr`, que corre con el JWT del usuario.

- `artists` y `venues` **no tienen ninguna policy de UPDATE** en las 28 migraciones
  → RLS deniega por defecto → PostgREST afecta 0 filas y devuelve `error: null`
  → el resolver reporta `success: true`. La aprobación falla en silencio.
- `events` tiene `"Allow update events" ... to authenticated using (true) with check (true)`
  → cualquier autenticado puede auto-aprobar su evento pegándole directo a
  PostgREST, salteando el guard `requireModerator` de GraphQL.

- [x] Migración nueva con `approve_entity(entity_type, id)` como RPC `SECURITY DEFINER`,
      con el mismo chequeo de rol que los tres merge.
      → `supabase/migrations/20260825060000_moderation_approve_and_status_guard.sql`
- [x] Cerrar el cambio de `status` a usuarios comunes. No se hizo tocando la policy:
      en una policy de UPDATE, `USING` ve la fila vieja y `WITH CHECK` la nueva, y no
      hay forma de correlacionarlas para expresar "permitido salvo que cambie status".
      Va por trigger `BEFORE UPDATE` en las tres tablas, que es el único mecanismo que
      ve OLD y NEW juntos. `"Allow update events"` se mantiene porque la necesita la
      edición legítima de recitales.
- [x] Reapuntar `approveArtist/Venue/Event` en `src/domains/moderation/service.ts` al RPC.
- [x] Chequeo de rol NULL-safe compartido (`is_moderator()`). Los tres merge usaban
      `IF get_user_role(...) NOT IN ('admin','moderador')`, y `get_user_role()` devuelve
      NULL cuando el usuario no tiene fila en `profiles`: `NULL NOT IN (...)` es NULL y
      `IF NULL THEN` es falsy en plpgsql, así que la guarda se salteaba y la fusión
      seguía. Es el mismo trap que `assign_user_role()` ya documenta y evita con
      `IS DISTINCT FROM` en `20260823202400_user_roles.sql`.

## Task 2: Capa API (GraphQL)

Archivo: `src/graphql/moderation.ts`, registrado en `src/graphql/schema.ts`.

- [x] Exponer el `status` en `EventRef`, `ArtistRef` y `VenueRef`.
- [x] Mutations con chequeo de rol de contexto `admin|moderador`.
- [x] Queries de la cola: `unverifiedArtists`, `unverifiedVenues`, `unverifiedEvents`.
- [x] Query `mergeTargets(entityType, query, excludeId)` para buscar la entidad
      canónica por nombre. Espejo del tool `search_catalog` del MCP: `ilike %q%`,
      sólo `status = 'verified'`, límite 8. Los índices GIN trigram sobre
      `artists.name`, `venues.name` y `events.name` ya existían en
      `20260824205500_performance_indexes.sql`. Devuelve `{ id, name, detail }`,
      donde `detail` es género / ciudad—dirección / fecha según la entidad, listo
      para el `sublabel` del `Combobox`.
- [x] Escapado de comodines de LIKE en el término de búsqueda. Sin esto, buscar
      "100%" matchea el catálogo entero justo antes de una fusión destructiva.
- [x] `requireModerator` tipado con `GraphQLContext` en vez de `any`, y tirando
      `GraphQLError` para que una denegación de permisos no viaje como error interno.
- [x] Tests: `src/domains/moderation/service.test.ts` y `src/graphql/moderation.test.ts`.

## Task 3: Pantallas UI (Next.js)

- [x] Layout `/app/admin/layout.tsx` con sidebar de navegación.
- [~] Panel `/app/admin/moderacion/artistas/page.tsx` con tabla.
  - [x] Tabla, empty state y estética brutalista.
  - [x] Acciones por fila cableadas a las mutations.
  - [ ] Leer `error`/`success` de la mutation en vez de asumir que salió bien.
  - [ ] Reemplazar el `confirm()` nativo del browser por la confirmación in-place.
  - [ ] Buscador de la entidad canónica en vez del input de UUID pelado.
- [ ] Instalar `framer-motion` y construir la fila animada compartida:
      colapso con `AnimatePresence` al aprobar, layout animation al expandir
      el panel de fusión.
- [~] Sedes (`/app/admin/moderacion/sedes/page.tsx`): tabla lista, botones sin `onClick`.
- [~] Eventos (`/app/admin/moderacion/eventos/page.tsx`): tabla lista, botones sin `onClick`.
      Falta la animación de advertencia sobre el movimiento de asistencias.
- [ ] Guard de rol: `/admin` no está en `protectedPaths` de
      `src/core/lib/supabase/middleware.ts`.
- [ ] Degradación: las tres páginas hacen `throw new Error(result.error.message)`.
      El resto del repo degrada (`getArtists()` loguea y devuelve `[]`;
      `/events/nuevo` hace `data?.venues ?? []`).

## Task 4: Servidor MCP (Headless AI)

Paquete: `mcp/` (Node independiente, `@modelcontextprotocol/sdk`).

- [x] Inicializar paquete independiente.
- [x] Exponer tools: `get_unverified_queue`, `search_catalog`, `approve_entity`, `merge_entity`.
- [ ] Probar conexión local interactiva.

Nota: `approve_entity` del MCP pega al mismo `UPDATE` bloqueado por RLS descripto
en Task 1b, así que arrastra el mismo fallo silencioso hasta que esa tarea cierre.
