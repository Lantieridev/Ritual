-- Fase 3 (R2 architecture finding): events.tour_id, events.festival_edition_id
-- and events.is_child_event belonged to an abandoned "tours" / "festival
-- editions" design that no application code reads or writes — the real
-- festival model is `festivals` + `festival_events` (see festivals/actions.ts,
-- festivals/data.ts). Verified via full-repo grep before writing this: the
-- only references left were these columns' own migrations, the generated
-- TS types, and a stale docs/architecture.md. The `tours` and
-- `festival_editions` tables themselves are equally dead — no `.from('tours')`
-- or `.from('festival_editions')` call exists anywhere in src/ or app/; the
-- only other migration that touches `tours` (20260712000000) does so purely
-- defensively, to keep its FK consistent while deduping artists, not because
-- anything reads it back.

alter table public.events
  drop column if exists tour_id,
  drop column if exists festival_edition_id,
  drop column if exists is_child_event;

drop table if exists public.tours;
drop table if exists public.festival_editions;
