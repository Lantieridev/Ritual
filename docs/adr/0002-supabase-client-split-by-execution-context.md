# 0002 — Cliente Supabase separado por contexto de ejecución

## Estado
Aceptada

## Contexto
Next.js App Router ejecuta código en tres contextos distintos con reglas de cookies diferentes: Client Components (browser), Server Components/Server Actions (request-scoped, cookies read-only en algunos casos) y Middleware (puede escribir cookies en la respuesta). Un único cliente de Supabase genérico rompe en alguno de los tres apenas se usa fuera de su contexto original — es el error clásico de SSR con Supabase Auth (sesión que no persiste, o que se cae en producción y no en local).

## Decisión
Módulos separados en `src/core/lib/supabase/`, cada uno con su propia estrategia de cookies:

- **`client.ts`** — `createBrowserClient`, sin manejo de cookies (lo hace el browser).
- **`server.ts`** — `createServerClient` usando `next/headers` `cookies()`; `setAll` está envuelto en try/catch porque Server Components no pueden escribir cookies (se asume que el middleware refresca la sesión).
- **`middleware.ts`** (`updateSession`) — `createServerClient` sobre `NextRequest`/`NextResponse`, con permiso real de escribir cookies en la respuesta, y acá mismo vive la protección de rutas (`/profile`, `/wishlist`, `/stats`, `/expenses` redirigen a `/login` si no hay usuario).

## Consecuencias
- Cada archivo se importa solo desde su contexto correspondiente — nunca `server.ts` desde un Client Component ni viceversa.
- La protección de rutas está centralizada en el middleware, no repetida en cada página protegida.
- Si se agrega una ruta protegida nueva, hay que sumarla a `protectedPaths` en `middleware.ts` — es manual, no hay convención de carpeta (ej. `(protected)/`) que lo haga automático todavía. Si la lista crece mucho vale la pena revisar ese approach.

## Nota (2026-08-23)
`client.ts` (el módulo browser de la lista de arriba) se eliminó el 2026-07-11 (`18b7a5e`, sin relación con la migración a GraphQL) — no quedó ningún Client Component que necesitara `createBrowserClient` directo. Los dos módulos que sí siguen vivos y activos son `server.ts` y `middleware.ts`; la decisión de fondo (un cliente por contexto de ejecución, nunca uno genérico) sigue vigente, solo que hoy son dos contextos con módulo propio en vez de tres. Si en algún momento un Client Component necesita leer Supabase directo otra vez, este es el lugar para recrear `client.ts` siguiendo el mismo patrón — no reintroducir un cliente genérico.
