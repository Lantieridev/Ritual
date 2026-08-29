-- Chat/coordinación por evento entre asistentes (issue #59). Un thread por
-- evento, visible sólo para quienes tienen attendance ahí (cualquier status:
-- interested/going/went) -- no es un chat general de la app, ni DMs 1 a 1.
--
-- Primera versión con polling simple del lado del cliente, no Supabase
-- Realtime todavía -- el propio issue deja esto como decisión abierta, y
-- polling es más barato de mantener para una primera versión sin usuarios
-- concurrentes reales que lo justifiquen.
create table public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index event_messages_event_id_idx on public.event_messages (event_id, created_at asc);

alter table public.event_messages enable row level security;

-- No hay policy `to public`/`anon` a propósito: a diferencia del catálogo
-- (artists/venues/events/venue_tips), esto NUNCA es público -- ni con
-- sesión alcanza, hace falta attendance en ESE evento puntual.
create policy "Attendees can view event messages"
  on public.event_messages
  as permissive
  for select
  to authenticated
  using (
    exists (
      select 1 from public.attendance
      where attendance.event_id = event_messages.event_id
        and attendance.user_id = (select auth.uid())
    )
  );

create policy "Attendees can send event messages"
  on public.event_messages
  as permissive
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.attendance
      where attendance.event_id = event_messages.event_id
        and attendance.user_id = (select auth.uid())
    )
  );

-- Borrar el propio mensaje o, si es moderador, cualquiera -- mismo criterio
-- que venue_tips.
create policy "Author or moderator can delete event messages"
  on public.event_messages
  as permissive
  for delete
  to authenticated
  using ((select auth.uid()) = user_id or is_moderator());
