# Estructura de `src/`

- **`core/`** – Lo que usa toda la app: tipos, Supabase, rutas, componentes UI y layout. No contiene lógica de un dominio concreto.
- **`domains/`** – Un folder por dominio (events, venues, artists, expenses). Cada uno tiene:
  - **`data.ts`** – Lectura de datos (getX, getXById).
  - **`actions.ts`** – Server Actions (create, update, delete).
  - **`components/`** – Componentes específicos del dominio (formularios, listas, etc.).

Las páginas en **`app/`** solo importan de `core` y `domains`; no hay lógica de negocio en `app/`.

Para agregar un nuevo dominio (ej. “perfil” o “amigos”): crear `domains/nuevo-dominio/` con data, actions y components, y las rutas en `app/`.
