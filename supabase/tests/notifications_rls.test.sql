-- notifications: el inbox y la cola de email. El cliente sólo lee sus filas
-- visibles (in_app) y sólo puede tocar read_at; nadie inserta desde el cliente.
-- notification_preferences: privadas por dueño.
begin;
select plan(14);

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

-- Filas sembradas como superusuario (equivale a service-role).
insert into public.notifications (id, user_id, type, title, body, dedupe_key, in_app, email_status)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'admin_message', 'Hola', 'Cuerpo', null, true, 'pending'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'post_show_reminder', 'Oculta', 'Sólo email', 'post_show:e1', false, 'pending'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'admin_message', 'Ajena', 'Cuerpo', null, true, 'skipped');

select has_table('public', 'notifications', 'la tabla notifications existe');
select has_table('public', 'notification_preferences', 'la tabla notification_preferences existe');

-- ─── dedupe ─────────────────────────────────────────────────────────────────
select throws_ok(
  $$insert into public.notifications (user_id, type, title, body, dedupe_key)
    values ('11111111-1111-1111-1111-111111111111', 'post_show_reminder', 'Dup', 'Dup', 'post_show:e1')$$,
  '23505',
  null,
  'el mismo (user_id, dedupe_key) no se puede insertar dos veces'
);

-- ─── el dueño ve sólo sus filas in_app ──────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is(
  (select count(*) from public.notifications)::int,
  1,
  'el dueño ve sólo su fila in_app (no la de sólo-email ni la ajena)'
);

update public.notifications set read_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select isnt(
  (select read_at from public.notifications where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  null,
  'el dueño puede marcar como leída su fila'
);

select throws_ok(
  $$update public.notifications set title = 'Hackeado' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'el dueño no puede editar columnas que no sean read_at'
);

select throws_ok(
  $$insert into public.notifications (user_id, type, title, body)
    values ('11111111-1111-1111-1111-111111111111', 'admin_message', 'Propia', 'x')$$,
  '42501',
  null,
  'el cliente no puede insertar notificaciones'
);

-- ─── preferencias: dueño sí, ajeno no ───────────────────────────────────────
insert into public.notification_preferences (user_id, type, in_app, email)
values ('11111111-1111-1111-1111-111111111111', 'admin_message', true, false);

select is(
  (select email from public.notification_preferences where user_id = '11111111-1111-1111-1111-111111111111' and type = 'admin_message'),
  false,
  'el dueño guarda y lee su preferencia'
);

select throws_ok(
  $$insert into public.notification_preferences (user_id, type, in_app, email)
    values ('22222222-2222-2222-2222-222222222222', 'admin_message', true, true)$$,
  '42501',
  null,
  'un usuario no puede escribir preferencias de otro'
);

reset role;

-- ─── otro usuario no ve la fila ajena ───────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is(
  (select count(*) from public.notifications where user_id = '11111111-1111-1111-1111-111111111111')::int,
  0,
  'otro usuario no lee notificaciones ajenas'
);

select is(
  (select count(*) from public.notification_preferences where user_id = '11111111-1111-1111-1111-111111111111')::int,
  0,
  'otro usuario no lee preferencias ajenas'
);

reset role;

-- ─── claim_pending_notifications ────────────────────────────────────────────
select is(
  (select count(*) from public.claim_pending_notifications(10))::int,
  2,
  'claim toma las 2 filas pending (una in_app, una sólo-email)'
);

select is(
  (select email_attempts from public.notifications where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1::smallint,
  'claim incrementa email_attempts'
);

select is(
  (select count(*) from public.claim_pending_notifications(10))::int,
  0,
  'una segunda corrida no re-toma filas recién reclamadas'
);

select * from finish();
rollback;
