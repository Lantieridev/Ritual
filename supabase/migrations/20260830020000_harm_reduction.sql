-- Issue #62: reducción de daños en el checklist de "modo recital activo".
-- Ritual apunta a cultura electrónica/rave (ver README), donde protectores
-- auditivos, hidratación y demás no son un genérico de concierto sino parte
-- real de la identidad de la escena.

-- ─── Pregunta post-show: ¿usaste protectores auditivos? ────────────────────
-- Nullable a propósito: null = todavía no contestó (no es lo mismo que
-- "no usó"), así el % de Wrapped solo cuenta a quienes sí respondieron.
-- Vive en `attendance` porque ahí ya están rating/review/notes desde que se
-- las plegó (ver 20260722010000_fold_memories_into_attendance.sql).
alter table public.attendance
  add column if not exists used_ear_protection boolean;

-- ─── Plantilla default del checklist para usuarios nuevos ──────────────────
-- checklist_template_items es por-usuario y hoy arranca vacía (cada uno
-- arma la suya) — no hay ninguna plantilla "compartida" que editar. Este
-- issue pide que la plantilla default incluya reducción de daños, así que
-- de paso se crea el mecanismo de seed en sí (no existía) sembrando SOLO
-- estos cuatro ítems para cuentas nuevas -no se inventa contenido genérico
-- de plantilla fuera del alcance de este issue, y las cuentas existentes no
-- se tocan (agregarles ítems a una plantilla que el usuario ya armó a su
-- gusto sería invasivo, no un default).
create or replace function public.seed_default_checklist_template()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.checklist_template_items (user_id, label, position)
  values
    (new.id, 'Protectores auditivos', 0),
    (new.id, 'Hidratación / agua', 1),
    (new.id, 'Comer antes de salir', 2),
    (new.id, 'Plan de vuelta', 3);
  return new;
end;
$$;

drop trigger if exists on_profile_created_seed_checklist on public.profiles;
create trigger on_profile_created_seed_checklist
  after insert on public.profiles
  for each row execute function public.seed_default_checklist_template();
