-- Issue #7 (soft spend suggestion): estimating a user's average past spend
-- at an event's venue or with its artist(s) queries expenses by event_id,
-- events by venue_id, and lineups by artist_id — three query shapes that
-- previously had no supporting index (expenses only had one on
-- (user_id, date), and lineups' only index is its composite PK on
-- (event_id, artist_id), which doesn't help an artist_id-only lookup).
--
-- At this app's personal scale (one user's own event/expense history) none
-- of this is slow today, but rather than silently letting it degrade as
-- history grows, the supporting indexes are added now.
create index if not exists expenses_event_id_idx on public.expenses (event_id);
create index if not exists events_venue_id_idx on public.events (venue_id);
create index if not exists lineups_artist_id_idx on public.lineups (artist_id);
