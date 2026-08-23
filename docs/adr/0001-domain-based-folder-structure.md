# 0001 — Estructura de carpetas por dominio (`core/` vs `domains/`)

## Estado
Aceptada

## Contexto
RITUAL no es un CRUD simple: mezcla itinerarios, gastos, perfiles, festivales/giras y varias integraciones externas (Last.fm, Spotify, Setlist.fm, Ticketmaster). Con `app/` de Next.js App Router manejando solo rutas, había que decidir dónde vive la lógica de negocio real para que el proyecto no termine con todo mezclado en los route handlers a medida que se agregan features.

## Decisión
Separar el código en dos capas:

- **`src/core/`**: lo transversal — componentes de UI reutilizables, clientes de Supabase, autenticación, tipos globales, utilidades. No conoce ningún dominio específico.
- **`src/domains/<dominio>/`**: la lógica de negocio agrupada por dominio (`artists`, `events`, `expenses`, `festivals`, `venues`, `auth`, `stats`, y luego `showmode` y `weather`). Cada dominio tiene sus propios `data.ts` y componentes; `actions.ts` era universal al momento de este ADR pero dejó de serlo con la migración a GraphQL — ver [ADR 0004](./0004-graphql-migration-strangler-fig.md).
- **`app/`**: solo rutas y composición de página, importando de `core/` y `domains/`.

## Consecuencias
- Agregar un dominio nuevo (ej. "reviews colaborativas") significa crear una carpeta nueva en `domains/`, no tocar `core/`.
- Un cambio en el cliente de Supabase o en un componente de UI base se hace una sola vez en `core/` y se propaga a todos los dominios.
- Riesgo a vigilar: si un dominio empieza a importar directamente de otro dominio (en vez de pasar por `core/`), la separación se erosiona. Vale la pena revisar esto en review cuando se sumen features nuevas.
