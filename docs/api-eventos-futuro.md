# API de eventos futuros: Ticketmaster

## Implementado

- **Objetivo**: Buscar recitales futuros por artista o por ciudad sin cargar la base de datos. Solo se persiste lo que el usuario agrega.
- **Config**: `TICKETMASTER_API_KEY` en `.env.local` (opcional; sin ella la búsqueda de shows futuros no está disponible, pero el resto de la app funciona igual).
- **Ruta**: `/buscar` (tab "Shows futuros"). También alimenta el badge de próximos shows en `/wishlist`.
- **Código**: `src/core/lib/ticketmaster.ts` (cliente), `src/domains/events/service.ts` → `addExternalEvent` (expuesta como mutación GraphQL en `src/graphql/events.ts`, ya no como Server Action — ver [ADR 0004](./adr/0004-graphql-migration-strangler-fig.md)), página `app/buscar/page.tsx`.
- **Historial pasado**: usa Setlist.fm por separado (`src/core/lib/setlistfm.ts`), tab "Historial pasado" en la misma página.

Cada resultado tiene "Agregar", que crea evento + sede + artista en nuestra DB si no existen (`findOrCreateByName` en `src/core/lib/find-or-create.ts`).

---

## Ampliaciones futuras

### 1. Origen del evento en la tabla

Añadir un campo opcional en `events` para distinguir origen:

- `source` (text, nullable): `'api'` | `'user'` | null (legacy).
- `external_id` (text, nullable): ID en la API externa (evita duplicados al re-sincronizar).

Migración ejemplo:

```sql
alter table public.events
  add column if not exists source text default 'user',
  add column if not exists external_id text unique;
```

### 2. Flujo de sincronización

- **Cron/Edge Function** (o ruta API protegida) que periódicamente:
  - Llama a Ticketmaster (por ciudad, artista, etc.).
  - Por cada evento: si no existe `external_id`, insertar en `events` (y en `venues`/`artists` si hace falta) con `source = 'api'` y `external_id`.
- **Usuario agrega recital**: igual que ahora, `source = 'user'` (o null), `external_id` null.

### 3. Deduplicación de venues y artistas

Ya resuelto para el flujo actual por `findOrCreateByName` (busca por nombre case-insensitive antes de crear). Con un job de sincronización periódica convendría además matchear por `external_id` de Ticketmaster para no depender solo del nombre.

### 4. Qué no tocar

- **RLS**: las políticas actuales (select público, insert/update/delete según lo que tengas) se pueden mantener; si más adelante solo usuarios autenticados pueden crear eventos, filtrar por `auth.uid()` en insert y dejar que los de API sigan con un service role o función con `security definer`.
- **Listado actual**: `getEvents()` puede seguir trayendo todos; en el front se puede filtrar por `source` si querés (ej. pestaña "Solo míos" vs "Todos").
- **Eliminación**: decidir si los eventos `source = 'api'` se pueden borrar por el usuario o solo ocultar (ej. columna `hidden` o no mostrarlos en "Mis recitales").

### 5. Performance

- Índices: `events(date)`, `events(source)`, `events(external_id)` (único).
- Paginación: cuando la cantidad de eventos crezca, `getEvents()` puede aceptar `limit`/`offset` o cursor por fecha. Ticketmaster ya devuelve `page.totalElements`/`totalPages` para esto.
- La API externa: llamarla desde servidor (ya es así, `src/core/lib/ticketmaster.ts` tiene `import 'server-only'`) y no desde el cliente, para no exponer la key.

---

Resumen: la búsqueda manual (usuario busca y agrega) ya está resuelta con Ticketmaster + Setlist.fm. Si en algún momento se quiere sincronización automática (sin que el usuario tenga que buscar), agregar `source`/`external_id` a `events` y un job en servidor que llame a Ticketmaster periódicamente.
