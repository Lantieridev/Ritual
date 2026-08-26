-- Restringe el borrado del catálogo compartido a admins y moderadores.
--
-- `"Allow delete events"` y `"Allow delete festivals"` estaban como
-- `using (true)` para cualquier `authenticated`: una cuenta recién creada
-- podía borrar cualquier recital o festival cargado por otra persona. La
-- migración original lo dejó anotado como deuda ("Más adelante se puede
-- restringir a auth.uid() o rol").
--
-- Se restringe el DELETE y no el UPDATE a propósito: el catálogo es
-- colaborativo y editarlo entre varios es el comportamiento buscado, pero el
-- borrado no tiene vuelta atrás. El cambio de `status` ya está cubierto
-- aparte por el trigger de 20260825060000.
--
-- `lineups` queda editable por cualquier autenticado porque borrar y volver a
-- insertar filas de lineup es parte del flujo normal de editar un recital.

drop policy if exists "Allow delete events" on "public"."events";
create policy "Moderators delete events"
  on "public"."events" for delete to authenticated
  using (public.is_moderator());

drop policy if exists "Public delete festivals" on "public"."festivals";
create policy "Moderators delete festivals"
  on "public"."festivals" for delete to authenticated
  using (public.is_moderator());

drop policy if exists "Public delete festival_events" on "public"."festival_events";
create policy "Moderators delete festival_events"
  on "public"."festival_events" for delete to authenticated
  using (public.is_moderator());
