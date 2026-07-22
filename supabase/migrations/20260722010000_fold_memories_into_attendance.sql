-- memories era una relación forzada 1:1 con attendance
-- (memories_attendance_id_key unique constraint, migración 20260711000000),
-- y cada lectura pagaba un join para reensamblar "mi experiencia de este
-- show". festival_attendance ya modela lo mismo plano, en una sola tabla —
-- este cambio lleva attendance al mismo patrón.
--
-- RLS: no hace falta ninguna policy nueva. attendance ya tiene policies
-- "Owner ..." (auth.uid() = user_id) por fila desde security_hardening —
-- agregar columnas a una tabla ya protegida por RLS no requiere policies
-- adicionales, Postgres las aplica a nivel de fila, no de columna.

alter table public.attendance
  add column if not exists rating integer check (rating >= 0 and rating <= 5),
  add column if not exists review text,
  add column if not exists notes text;

update public.attendance a
set rating = m.rating,
    review = m.review,
    notes = m.notes
from public.memories m
where m.attendance_id = a.id;

drop table if exists public.memories;
