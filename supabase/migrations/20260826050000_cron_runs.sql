-- Historial de corridas del cron de fuentes externas.
--
-- El cron respondía `{ success: true, ... }` sin importar cuántos de los 13
-- adaptadores de scraping fallaran: sólo quedaba un `console.error` por
-- adaptador, sin nada que sobreviva más que los logs de Vercel. Si el cron
-- falla varios días seguidos nadie se entera hasta que el cache vence a los
-- 7 días y la home muestra una lista vacía sin ningún aviso de degradación.
--
-- Sin presupuesto para monitoreo pago (Sentry/Datadog no están integrados),
-- la corrida queda persistida acá: un vistazo a esta tabla desde el propio
-- dashboard de Supabase alcanza para saber si el cron viene fallando.
create table if not exists public.cron_runs (
    id bigint generated always as identity primary key,
    job text not null,
    started_at timestamptz not null,
    finished_at timestamptz not null default now(),
    adapters_total integer not null,
    adapters_failed integer not null,
    events_inserted integer not null,
    ok boolean not null
);

create index if not exists cron_runs_job_finished_at_idx
    on public.cron_runs (job, finished_at desc);

alter table public.cron_runs enable row level security;

-- Sólo terceros con criterio de moderador necesitan ver el historial de
-- corridas; no es información de usuario ni tiene motivo para ser pública.
create policy "Moderators read cron_runs"
    on public.cron_runs for select
    to authenticated
    using (public.is_moderator());

-- Sólo el cron (service role, que bypassa RLS) escribe acá. Ningún rol de
-- PostgREST necesita insert/update/delete.
revoke insert, update, delete on public.cron_runs from anon, authenticated;
