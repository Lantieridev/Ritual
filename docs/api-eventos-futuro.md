# API de eventos: Bandsintown (implementado) y ampliaciones futuras

## Implementado: Bandsintown

- **Objetivo**: Buscar recitales por artista o por ciudad sin cargar la base de datos. Solo se persiste lo que el usuario agrega.
- **Config**: `BANDSINTOWN_APP_ID` en `.env.local` (opcional; sin él la búsqueda no está disponible).
- **Ruta**: `/buscar`. Desde ahí se busca por artista o por ubicación; los resultados vienen de la API. Cada resultado tiene "Agregar a mis recitales", que crea evento + sede + artista en nuestra DB si no existen.
- **Código**: `src/core/lib/bandsintown.ts` (cliente), `src/domains/events/actions.ts` → `addEventFromBandsintown`, página `app/buscar/page.tsx`.

---

## Ampliaciones futuras (doc original)

## Objetivo

- Cargar recitales **venideros y pasados** desde una API externa.
- Mantener la posibilidad de que el usuario **agregue recitales manualmente** (como hoy).
- Una sola lista unificada: eventos de API + eventos creados por usuarios.

## Enfoque recomendado

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
  - Llama a la API externa (por ciudad, artista, etc.).
  - Por cada evento: si no existe `external_id`, insertar en `events` (y en `venues`/`artists` si hace falta) con `source = 'api'` y `external_id`.
  - Opcional: marcar como “pasados” eventos con `date < today` (o no, y filtrar en la app).

- **Usuario agrega recital**: igual que ahora, `source = 'user'` (o null), `external_id` null.

### 3. Deduplicación de venues y artistas

- **Venues**: antes de insertar un evento de API, buscar venue por nombre+ciudad (o por `external_id` si la API da uno); si no existe, crear. Así no se duplican sedes.
- **Artists**: igual con artistas; tabla `artists` puede tener `external_id` (ej. Spotify ID) para matchear.

### 4. Qué no tocar

- **RLS**: las políticas actuales (select público, insert/update/delete según lo que tengas) se pueden mantener; si más adelante solo usuarios autenticados pueden crear eventos, filtrar por `auth.uid()` en insert y dejar que los de API sigan con un service role o función con `security definer`.
- **Listado actual**: `getEvents()` puede seguir trayendo todos; en el front se puede filtrar por `source` si querés (ej. pestaña “Solo míos” vs “Todos”).
- **Eliminación**: decidir si los eventos `source = 'api'` se pueden borrar por el usuario o solo ocultar (ej. columna `hidden` o no mostrarlos en “Mis recitales”).

### 5. Performance

- Índices: `events(date)`, `events(source)`, `events(external_id)` (único).
- Paginación: cuando la cantidad de eventos crezca, `getEvents()` puede aceptar `limit`/`offset` o cursor por fecha.
- La API externa: llamarla desde servidor (cron o API route) y no desde el cliente, para no exponer keys.

---

Resumen: agregar `source` y `external_id` a `events`, sincronizar con la API en un job en servidor, y seguir creando eventos manuales como hasta ahora. La misma lista y el mismo detalle sirven para ambos orígenes.
