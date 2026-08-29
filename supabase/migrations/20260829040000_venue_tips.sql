-- Tips prácticos crowdsourced por sede (issue #60): estacionamiento, cola,
-- qué llevar. `category` es texto con un check, no un enum de Postgres — más
-- simple de ampliar más adelante sin una migración de tipo.
--
-- Reutiliza check_creation_rate_limit() (ya genérico por TG_TABLE_NAME) y
-- is_moderator(), ambos ya existentes para artists/venues/events — un tip es
-- el mismo patrón de "contenido generado por usuarios sobre una entidad
-- compartida" que una entrada de catálogo nueva.
create table public.venue_tips (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  category text not null default 'otro' check (category in ('estacionamiento', 'cola', 'que_llevar', 'otro')),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index venue_tips_venue_id_idx on public.venue_tips (venue_id, created_at desc);

alter table public.venue_tips enable row level security;

create policy "Public venue tips"
  on public.venue_tips
  as permissive
  for select
  to public
  using (true);

create policy "Authenticated can add venue tips"
  on public.venue_tips
  as permissive
  for insert
  to authenticated
  with check (true);

-- El trigger de rate limit pisa created_by con auth.uid() en cada INSERT
-- (ver check_creation_rate_limit en 20260824202000), así que el check de
-- arriba no necesita comparar created_by a mano.
create policy "Owner or moderator can delete venue tips"
  on public.venue_tips
  as permissive
  for delete
  to authenticated
  using ((select auth.uid()) = created_by or is_moderator());

create trigger tr_venue_tips_rate_limit
  before insert on public.venue_tips
  for each row execute function check_creation_rate_limit();
