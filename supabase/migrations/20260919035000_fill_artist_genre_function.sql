-- issue #11: reemplaza la policy "Fill empty artist genre" por una función acotada.
--
-- Una policy de UPDATE en `artists` aplica a TODAS las columnas: como
-- `authenticated` tiene UPDATE a nivel de tabla, cualquier usuario podía
-- reescribir name, image_url o spotify_id de un artista sin género mientras
-- completara un género en el mismo UPDATE. La función sólo puede tocar el
-- género, y sólo si está vacío; nunca sobrescribe uno existente.
drop policy if exists "Fill empty artist genre" on public.artists;

create function public.fill_artist_genre(p_artist_id uuid, p_genre text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.artists
  set genre = p_genre
  where id = p_artist_id
    and (genre is null or genre = '')
    and p_genre is not null
    and p_genre <> '';
$$;

revoke execute on function public.fill_artist_genre(uuid, text) from public, anon;
grant execute on function public.fill_artist_genre(uuid, text) to authenticated;
