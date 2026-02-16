-- Políticas para editar/eliminar eventos, lineups (insert/delete) y alta de sedes.
-- Necesarias para: Editar recital, Eliminar recital, Lineup en form, Nueva sede.
-- Ejecutar en Supabase SQL Editor si no usás supabase db push.
-- Más adelante se puede restringir a auth.uid() o rol.

create policy "Allow update events"
  on "public"."events"
  as permissive
  for update
  to public
  using (true)
  with check (true);

create policy "Allow delete events"
  on "public"."events"
  as permissive
  for delete
  to public
  using (true);

create policy "Allow insert lineups"
  on "public"."lineups"
  as permissive
  for insert
  to public
  with check (true);

create policy "Allow delete lineups"
  on "public"."lineups"
  as permissive
  for delete
  to public
  using (true);

-- Sedes: permitir crear para que el usuario pueda dar de alta sin depender del dashboard
create policy "Allow insert venues"
  on "public"."venues"
  as permissive
  for insert
  to public
  with check (true);
