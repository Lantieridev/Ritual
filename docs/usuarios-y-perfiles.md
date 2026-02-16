# Usuarios y perfiles (futuro)

Cada usuario tendrá su propio historial de recitales (a los que fue, a los que va, etc.) y una especie de perfil. Este doc resume cómo está preparada la base y qué tocar cuando sumemos auth.

## Ya existe en la DB

- **`profiles`**: id (FK a auth.users), username, avatar_url, bio. Se crea con el trigger al registrarse.
- **`attendance`**: user_id (FK a profiles), event_id, status (`interested` | `going` | `went`). Es la tabla “mis recitales” por usuario.
- **`memories`**: vinculado a attendance (rating, review, media_urls) para después.

## Cuando agreguemos auth

1. **Supabase Auth**: ya está el cliente; faltará usar `getUser()` en layout o middleware y pasar usuario a componentes que lo necesiten.
2. **Rutas pensadas**: `/perfil` o `/me` (ver/editar perfil), listado “Mis recitales” filtrando por `attendance.user_id = auth.uid()`.
3. **RLS**: attendance y memories ya están restringidas por user_id; profiles permite ver todos y editar solo el propio.
4. **Eventos**: hoy son globales. Decidir si “Agregar recital” crea eventos públicos para todos o si cada usuario tiene “sus” eventos; en el segundo caso haría falta un `created_by` en events y políticas acordes.

## No cambiar ahora

- La app sigue funcionando sin login (modo público / single player).
- Al sumar auth, las pantallas “Mis recitales” y “Mi perfil” consumirán attendance y profiles sin tocar la estructura actual de eventos/sedes/artistas.
