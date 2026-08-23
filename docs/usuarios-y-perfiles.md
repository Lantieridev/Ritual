# Usuarios y perfiles

> Este doc describía originalmente un estado "futuro" (auth sin implementar todavía, tabla `memories` separada). Ambas cosas ya pasaron y cambiaron de forma: auth está implementado desde hace tiempo, y `memories` se eliminó en la migración `20260722010000_fold_memories_into_attendance.sql` — sus columnas (`rating`, `review`, `notes`) viven ahora directo en `attendance` (ver `docs/architecture.md`, nota histórica). Lo que sigue es el estado real.

## Auth: implementado

- **Supabase Auth** vía `@supabase/ssr`. Sesión resuelta server-side con `getCurrentUserId()` (`src/core/auth/session.ts`) — fuente única de verdad, no se repite por página.
- **Rutas**: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/profile`, `/profile/edit`.
- **Mutaciones de sesión** (`login`, `signup`, `signout`, `requestPasswordReset`, `updatePassword`): Server Actions en `src/core/auth/actions.ts`. No migraron a GraphQL — no hay una razón técnica que lo impida, simplemente no les tocó turno todavía en la migración del issue #23.
- **Edición de perfil** (`modifyProfile`/`updateProfile`): sí migró a GraphQL (`src/graphql/auth.ts`, mutación `updateProfile`), consumida desde `ProfileForm` con `useMutation` de urql.
- **Avatar**: sigue siendo Server Action a propósito (`src/domains/auth/avatar-actions.ts`) — recibe un `File` por `FormData`, y GraphQL Yoga no tiene un scalar `Upload` configurado. La URL resultante se guarda con el mismo `modifyProfile` de arriba, para que la escritura a `profiles` tenga un solo camino.
- **Protección de rutas**: `proxy.ts` (middleware de Next.js) redirige a `/login` en `/profile`, `/wishlist`, `/stats`, `/expenses` si no hay sesión — ver `src/core/lib/supabase/middleware.ts` y [ADR 0002](./adr/0002-supabase-client-split-by-execution-context.md).

## Modelo de datos real

- **`profiles`**: `id` (FK a `auth.users`), `username`, `avatar_url`, `bio`, `full_name`, `website`, `location`. Se crea con un trigger al registrarse. RLS: cualquiera puede leer, solo el dueño edita.
- **`attendance`**: `user_id`, `event_id`, `status` (`interested` | `going` | `went`), más `rating`, `review`, `notes` (fusionados desde `memories`, ver nota arriba). Es la tabla "mis recitales" por usuario.
- Detalle completo del resto del esquema (eventos, festivales, gastos, modo recital activo) en [`docs/architecture.md`](./architecture.md).

## Modo público (sin login)

La app sigue funcionando sin sesión: catálogo de eventos/artistas/sedes/festivales y búsqueda de shows futuros/pasados son visibles para cualquiera. Lo que requiere cuenta (asistencia, wishlist, gastos, perfil, modo recital activo) está detallado en [`docs/access-control.md`](./access-control.md), que es la fuente de verdad actual para permisos por rol — este doc se queda solo con el modelo de datos de usuarios/perfiles.

## Nota sobre "eventos son globales"

El catálogo compartido (eventos, artistas, sedes, festivales) no tiene `created_by`: cualquier usuario autenticado puede crear o editar cualquier fila, no solo la que él mismo cargó. Es una decisión deliberada, no un placeholder — ver `docs/access-control.md` para el razonamiento y qué pasaría si en el futuro se agrega un rol de administrador o moderación.
