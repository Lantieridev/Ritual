-- "Modo recital activo" (issue #9): ventana de tiempo alrededor de un show
-- durante la cual la app se activa para acompañar esa experiencia puntual.
--
-- Tres cosas nuevas, todas por usuario y con RLS de dueño:
--   1. user_preferences — la ventana es configurable por usuario, no un
--      número fijo para todos. Tabla genérica (no "show_mode_preferences")
--      porque es el primer lugar del proyecto donde vive una preferencia y
--      las que vengan después entran acá como columnas nuevas.
--   2. checklist_template_items — LA plantilla base del usuario, una sola,
--      configurada una vez y reusada en todos los shows.
--   3. event_checklist_items + event_checklist_checks — lo puntual de cada
--      show: ítems ad-hoc de ese show, y el estado tildado/destildado de los
--      ítems que vienen de la plantilla.
--
-- Por qué el estado de la plantilla vive en su propia tabla y no se copian
-- los ítems de la plantilla a cada show: si se copiaran, editar la plantilla
-- no se reflejaría en los shows futuros ya creados, y borrar un ítem dejaría
-- copias huérfanas por todos lados. Guardando solo el tilde por
-- (evento, ítem de plantilla), la plantilla sigue siendo la única fuente de
-- verdad del texto y el ON DELETE CASCADE limpia los tildes solo.

-- ─── Preferencias del usuario ───────────────────────────────────────────────

create table if not exists public.user_preferences (
  id uuid references auth.users(id) on delete cascade not null primary key,
  -- Defaults: 7 días antes / 2 días después. El issue no fija un número para
  -- el "antes" (solo dice que es configurable); una semana es cuando uno
  -- efectivamente empieza a resolver el show. Para el "después" el issue sí
  -- da un rango explícito ("1-2 días"), así que se toma el techo: 2.
  show_mode_days_before smallint not null default 7
    check (show_mode_days_before between 0 and 60),
  show_mode_days_after smallint not null default 2
    check (show_mode_days_after between 0 and 14),
  updated_at timestamptz default now()
);

alter table public.user_preferences enable row level security;

create policy "Users see own preferences"
  on public.user_preferences for select to authenticated
  using (auth.uid() = id);

create policy "Users insert own preferences"
  on public.user_preferences for insert to authenticated
  with check (auth.uid() = id);

create policy "Users update own preferences"
  on public.user_preferences for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─── Plantilla base del checklist pre-show ──────────────────────────────────

create table if not exists public.checklist_template_items (
  id uuid default extensions.uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  label text not null check (char_length(trim(label)) > 0),
  position smallint not null default 0,
  created_at timestamptz default now()
);

alter table public.checklist_template_items enable row level security;

create policy "Users see own checklist template"
  on public.checklist_template_items for select to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own checklist template"
  on public.checklist_template_items for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own checklist template"
  on public.checklist_template_items for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own checklist template"
  on public.checklist_template_items for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists checklist_template_items_user_idx
  on public.checklist_template_items (user_id, position, created_at);

-- ─── Ítems puntuales de un show ─────────────────────────────────────────────

create table if not exists public.event_checklist_items (
  id uuid default extensions.uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  event_id uuid references public.events(id) on delete cascade not null,
  label text not null check (char_length(trim(label)) > 0),
  position smallint not null default 0,
  checked boolean not null default false,
  created_at timestamptz default now()
);

alter table public.event_checklist_items enable row level security;

create policy "Users see own event checklist items"
  on public.event_checklist_items for select to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own event checklist items"
  on public.event_checklist_items for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own event checklist items"
  on public.event_checklist_items for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own event checklist items"
  on public.event_checklist_items for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists event_checklist_items_user_event_idx
  on public.event_checklist_items (user_id, event_id, position, created_at);

-- ─── Tilde de un ítem de plantilla, por show ────────────────────────────────

create table if not exists public.event_checklist_checks (
  user_id uuid references auth.users(id) on delete cascade not null,
  event_id uuid references public.events(id) on delete cascade not null,
  template_item_id uuid references public.checklist_template_items(id) on delete cascade not null,
  checked boolean not null default false,
  updated_at timestamptz default now(),
  primary key (user_id, event_id, template_item_id)
);

alter table public.event_checklist_checks enable row level security;

create policy "Users see own template checks"
  on public.event_checklist_checks for select to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own template checks"
  on public.event_checklist_checks for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own template checks"
  on public.event_checklist_checks for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own template checks"
  on public.event_checklist_checks for delete to authenticated
  using (auth.uid() = user_id);
