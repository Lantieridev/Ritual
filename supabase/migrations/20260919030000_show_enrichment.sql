-- issue #11: enriquecimiento silencioso de shows desde Ticketmaster.
--
-- poster_url: póster del show.
-- time_known: false cuando el usuario no cargó hora. events.date es
-- timestamptz, así que "sin hora" no se puede distinguir de una hora real
-- sin este flag. Las filas existentes quedan en true (tienen hora).
alter table public.events add column if not exists poster_url text;
alter table public.events add column if not exists time_known boolean not null default true;

-- artists sólo tenía select e insert: sin una policy de update, completar el
-- género desde el enriquecimiento afectaría 0 filas en silencio. Esta policy
-- sólo deja llenar un género vacío, nunca sobrescribir uno existente.
create policy "Fill empty artist genre"
  on public.artists
  as permissive
  for update
  to authenticated
  using (genre is null or genre = '')
  with check (genre is not null and genre <> '');
