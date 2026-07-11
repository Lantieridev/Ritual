-- findOrCreateByName (src/core/lib/find-or-create.ts) does a case-insensitive
-- select-by-name then insert-if-missing with no DB-level uniqueness backing
-- it, so two concurrent "Agregar" clicks on the same Ticketmaster/Setlist.fm
-- result can create duplicate venue/artist rows.
--
-- A plain `unique index on (lower(name))` can't be used as a PostgREST
-- upsert onConflict target — PostgREST generates `ON CONFLICT (columns)`
-- against real column names, not arbitrary expressions. So instead we add a
-- generated `name_key` column (lowercase of `name`, computed automatically
-- by Postgres on every insert/update) with a real unique constraint, and
-- upsert against that.
--
-- Defensive merge first, in case duplicate names already exist: for each
-- group of same-name (case-insensitive) rows, keep the oldest and repoint
-- every foreign key at the duplicates before deleting them (events.venue_id,
-- festivals.venue_id, tours.artist_id, lineups.artist_id, wishlist.artist_id).

alter table public.venues add column if not exists name_key text generated always as (lower(name)) stored;
alter table public.artists add column if not exists name_key text generated always as (lower(name)) stored;

-- ── venues ──────────────────────────────────────────────────────────────
with duped_venues as (
  select id,
         first_value(id) over (partition by name_key order by created_at, id) as canonical_id
  from public.venues
)
update public.events e
set venue_id = d.canonical_id
from duped_venues d
where e.venue_id = d.id and d.id <> d.canonical_id;

with duped_venues as (
  select id,
         first_value(id) over (partition by name_key order by created_at, id) as canonical_id
  from public.venues
)
update public.festivals f
set venue_id = d.canonical_id
from duped_venues d
where f.venue_id = d.id and d.id <> d.canonical_id;

with duped_venues as (
  select id,
         first_value(id) over (partition by name_key order by created_at, id) as canonical_id
  from public.venues
)
delete from public.venues v
using duped_venues d
where v.id = d.id and d.id <> d.canonical_id;

alter table public.venues add constraint venues_name_key_unique unique (name_key);

-- ── artists ─────────────────────────────────────────────────────────────
with duped_artists as (
  select id,
         first_value(id) over (partition by name_key order by created_at, id) as canonical_id
  from public.artists
)
update public.tours t
set artist_id = d.canonical_id
from duped_artists d
where t.artist_id = d.id and d.id <> d.canonical_id;

with duped_artists as (
  select id,
         first_value(id) over (partition by name_key order by created_at, id) as canonical_id
  from public.artists
)
update public.lineups l
set artist_id = d.canonical_id
from duped_artists d
where l.artist_id = d.id
  and d.id <> d.canonical_id
  and not exists (
    select 1 from public.lineups l2
    where l2.event_id = l.event_id and l2.artist_id = d.canonical_id
  );

-- Any lineup rows that couldn't be repointed (the canonical artist was
-- already in that event's lineup) are true duplicates of an existing row —
-- safe to drop.
with duped_artists as (
  select id,
         first_value(id) over (partition by name_key order by created_at, id) as canonical_id
  from public.artists
)
delete from public.lineups l
using duped_artists d
where l.artist_id = d.id and d.id <> d.canonical_id;

with duped_artists as (
  select id,
         first_value(id) over (partition by name_key order by created_at, id) as canonical_id
  from public.artists
)
update public.wishlist w
set artist_id = d.canonical_id
from duped_artists d
where w.artist_id = d.id
  and d.id <> d.canonical_id
  and not exists (
    select 1 from public.wishlist w2
    where w2.user_id = w.user_id and w2.artist_id = d.canonical_id
  );

with duped_artists as (
  select id,
         first_value(id) over (partition by name_key order by created_at, id) as canonical_id
  from public.artists
)
delete from public.wishlist w
using duped_artists d
where w.artist_id = d.id and d.id <> d.canonical_id;

with duped_artists as (
  select id,
         first_value(id) over (partition by name_key order by created_at, id) as canonical_id
  from public.artists
)
delete from public.artists a
using duped_artists d
where a.id = d.id and d.id <> d.canonical_id;

alter table public.artists add constraint artists_name_key_unique unique (name_key);
