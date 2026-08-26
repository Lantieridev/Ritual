# Estructura de `src/`

- **`core/`** – Lo que usa toda la app: tipos, Supabase, rutas, componentes UI y layout. No contiene lógica de un dominio concreto.
- **`domains/`** – Un folder por dominio. Hoy: `artists`, `auth`, `events`, `expenses`, `festivals`, `moderation`, `search`, `showmode`, `stats`, `venues`, `weather`. Cada uno tiene:
  - **`data.ts`** – Lectura de datos (getX, getXById).
  - **`service.ts`** – Casos de uso y escrituras. Es el seam que consumen las páginas y los resolvers.
  - **`components/`** – Componentes específicos del dominio (formularios, listas, etc.).
- **`graphql/`** – El schema de Pothos: un archivo por dominio, más el builder, el contexto (con los DataLoaders) y el cliente in-process.

Las páginas en **`app/`** solo importan de `core` y `domains`; no hay lógica de negocio en `app/`.

Para agregar un nuevo dominio: crear `domains/nuevo-dominio/` con data, service y components, sumar su archivo en `graphql/` si expone API, y las rutas en `app/`.

**Deuda conocida:** la capa `actions.ts` que describía este documento se eliminó en el issue #23 y su contenido vive hoy en `service.ts`. El dominio `moderation` todavía no tiene `data.ts` separado (habla contra Supabase directo desde `service.ts`).

La regla de que todo pase por `service.ts` — declarada en los comentarios de cada dominio desde el issue #25 — se cerró del todo el 2026-08-26: `src/graphql/`, las páginas de `app/` y los demás dominios ya no importan `data.ts` directo en ningún lado (commit `ced3ddb`).
