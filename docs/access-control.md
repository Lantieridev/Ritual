# Acceso por rol

Ritual tiene dos roles reales hoy: **visitante sin sesión** y **usuario autenticado**. No hay roles de administrador ni de moderación todavía. Este documento existe para que quede claro, en un solo lugar, qué puede ver y hacer cada uno — la fuente de la verdad real es la política RLS de cada tabla en `supabase/migrations/`; esta tabla es un resumen legible, no un reemplazo.

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

No existe hoy ningún concepto de "administrador" ni de contenido moderado por la app — cualquier fila del catálogo compartido (evento, artista, sede, festival) puede ser creada o editada por cualquier usuario autenticado, no solo por quien la creó originalmente. Si en el futuro se agrega un rol de administrador (por ejemplo, para publicar noticias o moderar el catálogo), este documento es el lugar para registrar esa distinción.
