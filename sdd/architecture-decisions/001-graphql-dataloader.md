# ADR 001: GraphQL DataLoader para resolución de N+1

## Contexto
En `src/graphql/events.ts`, los resolvers de `myAttendance` y `photos` sobre el tipo `EventRef` estaban ejecutando consultas individuales a Supabase (via `getAttendanceForEvent` y `getEventPhotos`) por cada evento evaluado.
Si bien esto no era problemático para la consulta `event(id)` individual, generaba un problema de N+1 crítico al solicitar estos campos dentro de consultas que devuelven colecciones de eventos (`events` o `eventsWithAttendance`).

## Decisión
Se decidió implementar el patrón **DataLoader** (librería `dataloader` de GraphQL) a nivel del contexto (`GraphQLContext`).

## Implementación
1. **Batch Functions**: Se agregaron dos funciones a la capa de datos (`attendance-data.ts` y `photo-actions.ts`) preparadas para recibir un arreglo de `eventIds`:
   - `getAttendanceForEventsBatch(eventIds, userId)`
   - `getEventPhotosBatch(eventIds)`
2. **Contexto por request**: En `createGraphQLContext` (`context.ts`) se instancian `attendanceLoader` y `photosLoader`. Al hacerlo por request, nos aseguramos de que el caché de DataLoader no se filtre transversalmente entre distintos usuarios.
3. **Resolvers**: Se modificó `EventRef` para que dependa del loader: `context.attendanceLoader.load(e.id)` y `context.photosLoader.load(e.id)`. DataLoader se encarga de acumular todas las promesas en el mismo tick de ejecución y disparar la consulta a la base de datos de manera agrupada (`IN (...)`).

## Consecuencias
- **Rendimiento**: Una lista de 50 eventos con fotos y asistencia ahora ejecuta 1 query de eventos, 1 de fotos y 1 de asistencia (3 queries totales) en lugar de 101 queries individuales.
- **Testing**: Los tests de GraphQL (`events.test.ts`) ahora mockean las funciones batch en lugar de las unitarias para simular el comportamiento.
