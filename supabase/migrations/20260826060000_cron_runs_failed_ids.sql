-- `cron_runs` guardaba cuántos adaptadores fallaban pero no cuáles, así que
-- diagnosticar una corrida mala seguía requiriendo ir a buscar los logs de
-- Vercel. Con el id del adaptador guardado ahí mismo alcanza con mirar la fila.
alter table public.cron_runs
    add column if not exists failed_adapter_ids text[] not null default '{}';
