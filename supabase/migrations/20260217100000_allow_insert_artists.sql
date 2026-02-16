-- Permitir crear artistas desde la app (formulario "Nuevo artista").
create policy "Allow insert artists"
  on "public"."artists"
  as permissive
  for insert
  to public
  with check (true);
