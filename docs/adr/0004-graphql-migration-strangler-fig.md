# 0004 — Migración de Server Actions a GraphQL (Yoga + Pothos + urql), patrón strangler fig

## Estado
Aceptada — en curso (issue [#23](https://github.com/Lantieridev/Ritual/issues/23))

## Contexto
El backend usaba Server Actions de Next.js para todas las escrituras. Server Actions solo funcionan dentro de esa misma app web: un cliente separado (por ejemplo una futura PWA o app nativa en Swift/Kotlin) no puede consumirlas. En vez de mantener para siempre una arquitectura mitad Server Actions / mitad API, se decidió reescribir el backend como una API GraphQL real.

## Decisión

### Stack elegido
- **GraphQL Yoga** como servidor — liviano, se integra bien con route handlers de Next.js App Router (`app/api/graphql/route.ts` reexporta `yoga.handleRequest`).
- **Pothos** para el schema, code-first — tipos TypeScript en vez de archivos `.graphql` separados y sin codegen; los tipos de respuesta se escriben a mano en `src/core/types/index.ts`.
- **urql** como cliente — más liviano que Apollo Client para el tamaño de esta app.

Se descartó **tRPC** (la alternativa típica en el ecosistema Next.js) porque depende de compartir tipos de TypeScript entre cliente y servidor — no sirve para un cliente nativo real en Swift/Kotlin, que es justo el caso que motiva dejar de depender de Server Actions.

### Ejecución in-process (sin round-trip HTTP)
Los Server Components leen con `getClient().query()` (`src/graphql/client.ts`), un cliente urql cuyo `fetch` apunta a `yoga.fetch` directamente en vez de hacer una request HTTP real contra la propia app (ver PR #44). Se comprobó empíricamente (probe query leyendo `cookies()` dentro de un resolver) que Next.js sigue propagando las cookies de sesión a esa ejecución in-process, así que la autenticación no se pierde. La URL de fetch (`http://localhost/api/graphql`) nunca se marca — solo tiene que matchear el `graphqlEndpoint` que Yoga espera, porque Yoga rutea sobre ese path y devuelve 404 a cualquier otro (bug real encontrado y corregido en PR #44).

Los Client Components escriben con `useMutation` de urql, desenvolviendo el resultado con el helper `unwrapMutation` (`src/graphql/mutation-result.ts`).

### Patrón de migración: strangler fig
Migración incremental a propósito, no un reemplazo de todo junto:
1. Se construyó primero el schema de GraphQL completo (queries y mutations) para los dominios con escritura.
2. Se apuntó el frontend real (páginas y componentes) a GraphQL dominio por dominio, verificando que no rompiera nada.
3. El `actions.ts` de cada dominio se borra una vez que nadie lo importa — no antes.

Cualquier feature nueva que necesite un endpoint de backend se agrega directo en `src/graphql/`, no como una Server Action nueva (ver `CONTRIBUTING.md`).

### Estado real (2026-08-23, tras PRs #44/#46/#49)
- **Queries**: los 7 dominios con lectura relevante (`artists`, `auth`, `events`, `expenses`, `festivals`, `stats`, `venues`) tienen schema en `src/graphql/`.
- **Mutations — 100% migrados** (sin `actions.ts` en el dominio): `artists`, `expenses`, `festivals`, `venues`.
- **Mutations — híbridos**: `events` (alta/edición/borrado de evento y `addExternalEvent` ya son GraphQL; asistencia y fotos siguen como Server Action en `attendance-actions.ts`/`photo-actions.ts`) y `auth` (edición de perfil ya es GraphQL; login/signup/signout/reset de contraseña siguen en `src/core/auth/actions.ts`, y el avatar queda como Server Action a propósito — ver más abajo).
- **Sin migrar**: `showmode` (modo recital activo, issue #9) — es 100% Server Actions, no le tocó turno todavía.

### Excepción deliberada: subida de archivos
El avatar de perfil (`src/domains/auth/avatar-actions.ts`) sigue siendo una Server Action a propósito y va a seguir siéndolo aunque el resto de `auth` termine de migrar: recibe un `File` por `FormData`, y GraphQL Yoga no tiene un scalar `Upload` configurado en este proyecto. La URL que devuelve entra después por `avatar_url` a la misma mutación `updateProfile`, para que la escritura a la tabla `profiles` tenga un solo camino.

## Consecuencias
- Mientras dura la migración, el código convive con dos patrones de backend a propósito — no es deuda accidental, es la forma elegida de migrar sin un big-bang. `CONTRIBUTING.md` documenta esto para quien contribuya código nuevo mientras tanto.
- La validación de sesión (`getCurrentUserId()`) vive en `service.ts`, no en `actions.ts` ni en el resolver — así un mismo caso de uso sirve de caller tanto a una Server Action como a un resolver GraphQL sin duplicar la validación (ver `docs/access-control.md`).
- Cualquier integración futura que necesite subir archivos binarios tiene el mismo problema que el avatar: hasta que no se configure un scalar `Upload` en Yoga, esa escritura puntual se queda en Server Action aunque el resto del dominio esté en GraphQL.
- El cliente urql in-process ahorra un round-trip HTTP en cada lectura server-side, pero acopla la validez de esa optimización a que Next.js siga propagando cookies a `yoga.fetch` tal como lo hace hoy — si eso cambiara en una versión futura de Next.js, las lecturas server-side dejarían de autenticar silenciosamente. Vale la pena un test de regresión sobre ese comportamiento si no existe todavía.
