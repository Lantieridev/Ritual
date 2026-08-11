-- cron_runs gana `details` (jsonb) para que los nuevos crons de taste
-- (importance/lastfm) escriban sus propios contadores sin cargar con los
-- 3 contadores "legacy" del cron de fuentes externas, que hasta ahora eran
-- `not null` sin default y obligaban a inventar valores falsos.
begin;
select plan(5);

select lives_ok(
  $$ insert into public.cron_runs (job, started_at, ok) values ('refresh-artist-importance', now(), true) $$,
  'insertar cron_runs con sólo job/started_at/ok funciona'
);

select is(
  (select adapters_total from public.cron_runs where job = 'refresh-artist-importance'),
  0,
  'adapters_total default a 0 cuando no se especifica'
);
select is(
  (select adapters_failed from public.cron_runs where job = 'refresh-artist-importance'),
  0,
  'adapters_failed default a 0 cuando no se especifica'
);
select is(
  (select events_inserted from public.cron_runs where job = 'refresh-artist-importance'),
  0,
  'events_inserted default a 0 cuando no se especifica'
);
select is(
  (select details from public.cron_runs where job = 'refresh-artist-importance'),
  '{}'::jsonb,
  'details default a {} cuando no se especifica'
);

select * from finish();
rollback;
