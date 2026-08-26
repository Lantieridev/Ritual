# Acceso por rol

Ritual tiene cuatro niveles de acceso: **visitante sin sesión**, **usuario autenticado**, **moderador** y **admin**. Los dos últimos sólo gatean la cola de moderación y el borrado del catálogo; el detalle está en la sección "Roles" más abajo. Este documento existe para que quede claro, en un solo lugar, qué puede ver y hacer cada uno — la fuente de la verdad real es la política RLS de cada tabla en `supabase/migrations/`; esta tabla es un resumen legible, no un reemplazo.

## Resumen por área

| Área | Sin sesión | Con sesión |
|---|---|---|
| Catálogo de eventos, artistas, sedes, festivales (lectura) | ✅ Ve todo | ✅ Ve todo |
| Catálogo de eventos, artistas, sedes, festivales (alta/edición/borrado) | ❌ | ✅ |
| Buscar shows externos (Ticketmaster / Setlist.fm) | ✅ Puede buscar | ✅ Puede buscar y guardar |
| Asistencia a un show (`attendance`: interesado / voy / fui, rating, reseña, notas) | ❌ No existe sin usuario | ✅ Propia únicamente |
| Wishlist de artistas seguidos | ❌ No tiene sentido sin cuenta | ✅ Propia únicamente |
| Gastos personales | ❌ No tiene sentido sin cuenta | ✅ Propios únicamente |
| Fotos de eventos | ✅ Ve todas | ✅ Ve todas, borra solo las propias |
| Perfil de usuario | — | ✅ Propio únicamente |

## Por qué la nav se separó en dos grupos

El catálogo compartido (Artistas, Sedes, Festivales, Buscar, Stats) tiene sentido navegarlo sin cuenta — es información pública de la app. Wishlist y Gastos son datos exclusivamente de una cuenta: mostrarlos a un visitante sin sesión no lleva a ningún lado útil (pantalla vacía o un cartel de "iniciá sesión"), así que solo aparecen en la navegación principal una vez que hay un usuario logueado. Ver `src/core/components/layout/Navbar.tsx`.

**Inconsistencia conocida, no resuelta todavía**: `/stats` sigue siendo visible sin sesión pese a mostrar datos 100% personales (vacíos para un visitante anónimo, en vez de un cartel explicando por qué). Queda pendiente decidir si se agrupa con Wishlist/Gastos o si se le agrega un estado vacío más claro para el caso sin sesión.

## Cómo se aplica en el backend

Todo lo de la tabla de arriba está reforzado con Row Level Security en Postgres, no solo en la UI — un usuario no puede escribir datos de otro aunque manipule la request directamente. Cada Server Action de escritura además valida la sesión de entrada (`getCurrentUserId()`) antes de tocar la base, para fallar con un mensaje claro en vez de depender solo del rechazo silencioso de RLS.

### Roles

Existe una columna `role` en `profiles` (`usuario` / `moderador` / `admin`, default `usuario`). Lo que gatea hoy:

- **`assignRole`**: sólo un admin cambia el rol de otro usuario, vía la función `assign_user_role`, que revalida el permiso por su cuenta. El campo `role` de `Profile` sólo lo ve el dueño del perfil o un admin.
- **Cola de moderación** (`/admin/moderacion/*`): las queries `unverified*`, las mutations `approve*` y `merge*`, y la query `mergeTargets` exigen `admin` o `moderador` en el resolver. Del lado de la base, `approve_entity` y los tres `merge_*` son `SECURITY DEFINER` y revalidan el rol adentro, así que pegarle directo a PostgREST no lo saltea.
- **Cambio de `status`** (verificado / sin verificar): un trigger `BEFORE UPDATE` en `artists`, `venues` y `events` rechaza la transición si quien la hace no es admin ni moderador. Va por trigger y no por policy porque en una policy de UPDATE no se pueden correlacionar la fila vieja y la nueva.
- **Borrado del catálogo**: eliminar un evento o un festival está restringido a admin y moderador, en RLS y en el service. La **edición** sigue abierta a cualquier autenticado a propósito: el catálogo es colaborativo y el borrado es lo único sin vuelta atrás.
- **Alta y borrado de festivales**: a diferencia de eventos/artistas/sedes, los festivales quedan fuera del scope comunitario (`01-spec.md` §4, fase 2) por su complejidad multi-día — no entran a la cola de moderación como `unverified`, se reservan a alta top-down. Crear (`insertFestival`), vincular un evento a un día (`linkEventToFestival`) y borrar (`removeFestival`) exigen `admin` o `moderador`, en RLS y en el service.

**Pendiente:** el log de auditoría todavía no existe.

El modelo es de **post-moderación**: lo que carga un usuario se publica al instante con `status = 'unverified'` y queda visible en la app pública. La cola sirve para revisarlo después, no para retenerlo. Falta una marca visual de "sin verificar" en las vistas públicas.
