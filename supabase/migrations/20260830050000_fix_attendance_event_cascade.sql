-- Bug real, encontrado por revisión externa (agy) y confirmado en vivo
-- reproduciendo exactamente lo que hace removeEvent(): "Romper este talón"
-- fallaba con una violación de foreign key para CUALQUIER evento que
-- tuviera al menos una fila de attendance -es decir, prácticamente todos,
-- ya que cualquier "me interesa"/"voy"/"fui" de cualquier usuario alcanza.
--
-- attendance.event_id no tenía ON DELETE CASCADE. removeEvent() ya sabe
-- borrar `lineups` a mano antes del evento (esa tabla tampoco cascadea,
-- a propósito, porque el borrado ahí lo puede hacer cualquier autenticado
-- vía RLS) -pero nunca hacía lo mismo con `attendance`, que además NO
-- puede hacerse a mano de la misma forma: la policy de attendance
-- ("Owner manages own attendance") sólo deja borrar la fila propia, así
-- que el moderador que borra el evento no podría borrar la attendance de
-- otros usuarios ni con un DELETE explícito.
--
-- La solución correcta es ON DELETE CASCADE a nivel de base: un cascade
-- disparado por la foreign key corre como parte de la acción referencial,
-- no como un DELETE nuevo sujeto a RLS de quien lo originó -mismo patrón
-- que ya funciona hoy para festival_attendance_festival_id_fkey.
alter table public.attendance
  drop constraint attendance_event_id_fkey,
  add constraint attendance_event_id_fkey
    foreign key (event_id) references public.events(id) on delete cascade;
