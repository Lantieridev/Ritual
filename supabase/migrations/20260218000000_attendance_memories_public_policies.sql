-- Políticas permisivas para attendance y memories en modo single-player (sin auth real).
-- Cuando se implemente auth real, reemplazar estas políticas por las que filtran por auth.uid().

-- Attendance: permitir todas las operaciones públicamente
create policy "Public insert attendance"
  on "public"."attendance"
  as permissive
  for insert
  to public
  with check (true);

create policy "Public select attendance"
  on "public"."attendance"
  as permissive
  for select
  to public
  using (true);

create policy "Public update attendance"
  on "public"."attendance"
  as permissive
  for update
  to public
  using (true);

create policy "Public delete attendance"
  on "public"."attendance"
  as permissive
  for delete
  to public
  using (true);

-- Memories: permitir todas las operaciones públicamente
create policy "Public insert memories"
  on "public"."memories"
  as permissive
  for insert
  to public
  with check (true);

create policy "Public select memories"
  on "public"."memories"
  as permissive
  for select
  to public
  using (true);

create policy "Public update memories"
  on "public"."memories"
  as permissive
  for update
  to public
  using (true);

create policy "Public delete memories"
  on "public"."memories"
  as permissive
  for delete
  to public
  using (true);
