-- Storage policies para el bucket event-photos
-- Las políticas de la tabla event_photos (DB) son distintas a las de Storage.
-- Supabase Storage usa la tabla storage.objects con sus propias políticas RLS.

-- Permitir SELECT (ver fotos) a todos
create policy "Public read event-photos"
  on storage.objects for select
  to public
  using (bucket_id = 'event-photos');

-- Permitir INSERT (subir fotos) a todos (single-player app, sin auth)
create policy "Public upload event-photos"
  on storage.objects for insert
  to public
  with check (bucket_id = 'event-photos');

-- Permitir DELETE (borrar fotos) a todos
create policy "Public delete event-photos"
  on storage.objects for delete
  to public
  using (bucket_id = 'event-photos');

-- Permitir UPDATE (reemplazar fotos) a todos
create policy "Public update event-photos"
  on storage.objects for update
  to public
  using (bucket_id = 'event-photos');
