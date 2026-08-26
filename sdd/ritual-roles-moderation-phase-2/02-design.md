# Diseño Técnico: Fase 2 - Cola de Moderación & MCP

## 1. Cambios en la Base de Datos (Supabase)

### Nuevo Tipo Enum
```sql
CREATE TYPE verification_status AS ENUM ('unverified', 'verified');
```

### Alteración de Tablas
Agregar la columna `verification_status` con default `unverified` a:
- `artists`
- `venues`
- `events`

*(Nota: los cargados por cron/adapters pueden nacer directamente como `verified`)*.

### Funciones RPC de Fusión (Merge)
La magia ocurre en la DB para garantizar transaccionalidad atómica. 
Se crearán 3 RPCs (Postgres Functions):
- `merge_artists(source_id UUID, target_id UUID)`
- `merge_venues(source_id UUID, target_id UUID)`
- `merge_events(source_id UUID, target_id UUID)`

**Ejemplo de flujo en `merge_artists`**:
1. Actualizar `event_artists` donde `artist_id = source_id` a `target_id`. (Manejar conflictos si el target ya tocaba en ese evento).
2. Mover registros en `user_wishlist`.
3. Borrar el `source_id` de `artists`.

## 2. Servidor MCP (Headless AI Moderation)

Un paquete Node ligero en `src/mcp-server/` (o paquete independiente en el repo) usando `@modelcontextprotocol/sdk`.

**Herramientas Expuestas:**
- `ritual_get_unverified(entity_type)`: Devuelve la cola.
- `ritual_approve(entity_type, id)`: Pasa a `verified`.
- `ritual_merge(entity_type, source_id, target_id)`: Llama a la RPC correspondiente.

## 3. Interfaz Gráfica (Next.js)

Rutas dentro de `app/admin/`:
- `app/admin/layout.tsx`: Sidebar con navegación (Cola de Moderación, Usuarios, etc).
- `app/admin/moderacion/artistas/page.tsx`: Tabla de artistas `unverified`.
- `app/admin/moderacion/sedes/page.tsx`: Tabla de sedes.
- `app/admin/moderacion/eventos/page.tsx`: Tabla de eventos.

**Componentes Core:**
- Botón "Aprobar".
- Modal "Fusionar con...": Abre un buscador de la entidad (combo box) para elegir la canónica y confirmar la fusión.

## 4. GraphQL API
Exponer mutations seguras controladas por RLS / Guards:
- `approveArtist`, `approveVenue`, `approveEvent`.
- `mergeArtist`, `mergeVenue`, `mergeEvent`.
Solo accesibles si el usuario tiene rol `admin` o `moderador`.
